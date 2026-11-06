import { eq, inArray, sql } from "drizzle-orm";
import type { Banco } from "./db";
import {
  auditoria,
  configuracao,
  conta,
  transacao,
  user,
  type Papel,
  type TipoTransacao,
} from "./db/schema";

/**
 * O livro da moeda. Todo movimento de Desapego passa por este arquivo, e as
 * regras da seção 2 do PRD moram aqui e em nenhum outro lugar:
 *
 * - cada transação debita uma conta e credita outra no mesmo valor, então a
 *   soma de todos os saldos é sempre zero;
 * - o limite negativo vale para quem inicia a saída; Tomar, saque e estorno
 *   podem deixar a outra ponta negativa;
 * - transações nunca são alteradas, só estornadas.
 */

export const LIMITE_PADRAO_CAIXA = 1000;
export const CHAVE_LIMITE_CAIXA = "limite_padrao_caixa";

export type CodigoErro =
  | "VALOR_INVALIDO"
  | "MESMA_CONTA"
  | "USUARIO_NAO_ENCONTRADO"
  | "CONTA_DESATIVADA"
  | "SEM_PERMISSAO"
  | "DESCRICAO_OBRIGATORIA"
  | "SALDO_INSUFICIENTE"
  | "CONFIRMACAO_NECESSARIA"
  | "TRANSACAO_NAO_ENCONTRADA"
  | "JA_ESTORNADA"
  | "CHAVE_REUTILIZADA";

export class ErroLedger extends Error {
  constructor(
    public codigo: CodigoErro,
    mensagem: string,
    /** Números para a tela explicar o erro (quanto falta, saldo resultante). */
    public dados: Record<string, number> = {},
  ) {
    super(mensagem);
    this.name = "ErroLedger";
  }
}

export type Transacao = typeof transacao.$inferSelect;

/** Tipos em que o valor sai da conta de quem opera. */
const SAI_DO_OPERADOR = new Set<TipoTransacao>(["envio", "dar", "deposito_cedula"]);
/** Tipos em que o valor sai da conta da outra pessoa e entra na de quem opera. */
const ENTRA_NO_OPERADOR = new Set<TipoTransacao>(["tomar", "saque_cedula"]);

const DESCRICAO_PADRAO: Partial<Record<TipoTransacao, string>> = {
  deposito_cedula: "Depósito de cédulas",
  saque_cedula: "Saque em cédulas",
};

type Tx = Parameters<Parameters<Banco["transaction"]>[0]>[0];

async function limitePadraoCaixa(tx: Tx | Banco): Promise<number> {
  const [linha] = await tx
    .select({ valor: configuracao.valor })
    .from(configuracao)
    .where(eq(configuracao.chave, CHAVE_LIMITE_CAIXA));
  return linha?.valor ?? LIMITE_PADRAO_CAIXA;
}

/** Quanto a conta pode ficar abaixo de zero. `null` = sem limite. */
function limiteEfetivo(
  papel: Papel,
  limiteDaConta: number | null,
  padraoCaixa: number,
): number | null {
  if (papel === "admin") return null;
  if (limiteDaConta !== null) return limiteDaConta;
  return papel === "caixa" ? padraoCaixa : 0;
}

async function carregarPessoas(tx: Tx, ids: string[]) {
  const pessoas = await tx
    .select({ id: user.id, papel: user.papel, ativo: user.ativo })
    .from(user)
    .where(inArray(user.id, ids));
  return new Map(pessoas.map((p) => [p.id, p]));
}

/**
 * Garante que as contas existem e as trava até o fim da transação do banco.
 * A ordem fixa (por id) impede deadlock entre A→B e B→A simultâneos.
 */
async function travarContas(tx: Tx, ids: string[]) {
  await tx
    .insert(conta)
    .values(ids.map((usuarioId) => ({ usuarioId })))
    .onConflictDoNothing();
  const contas = await tx
    .select()
    .from(conta)
    .where(inArray(conta.usuarioId, ids))
    .orderBy(conta.usuarioId)
    .for("update");
  return new Map(contas.map((c) => [c.usuarioId, c]));
}

async function mover(
  tx: Tx,
  dados: Omit<typeof transacao.$inferInsert, "id" | "criadaEm">,
): Promise<Transacao> {
  const [criada] = await tx.insert(transacao).values(dados).returning();
  await tx
    .update(conta)
    .set({ saldo: sql`${conta.saldo} - ${dados.valor}`, atualizadaEm: sql`now()` })
    .where(eq(conta.usuarioId, dados.deConta));
  await tx
    .update(conta)
    .set({ saldo: sql`${conta.saldo} + ${dados.valor}`, atualizadaEm: sql`now()` })
    .where(eq(conta.usuarioId, dados.paraConta));
  return criada;
}

async function buscarPorChave(tx: Tx, chave: string, operadorId: string) {
  const [existente] = await tx
    .select()
    .from(transacao)
    .where(eq(transacao.chaveIdempotencia, chave));
  if (!existente) return null;
  if (existente.operadorId !== operadorId) {
    throw new ErroLedger("CHAVE_REUTILIZADA", "Chave de idempotência já usada.");
  }
  return existente;
}

export type PedidoTransferencia = {
  /** Quem está logado e apertou o botão. */
  operadorId: string;
  /** A outra pessoa. */
  contraparteId: string;
  tipo: Exclude<TipoTransacao, "estorno">;
  valor: number;
  descricao?: string;
  chaveIdempotencia: string;
  /**
   * Tomar e saque que deixariam a pessoa negativa (ou além do limite dela) só
   * passam com isto ligado, depois de o Caixa ver o aviso.
   */
  confirmarNegativo?: boolean;
};

export async function transferir(
  db: Banco,
  pedido: PedidoTransferencia,
): Promise<{ transacao: Transacao; repetida: boolean }> {
  const { operadorId, contraparteId, tipo, valor, chaveIdempotencia } = pedido;
  const descricao = (pedido.descricao ?? "").trim() || DESCRICAO_PADRAO[tipo] || "";

  if (!Number.isSafeInteger(valor) || valor < 1) {
    throw new ErroLedger("VALOR_INVALIDO", "O valor precisa ser um número inteiro maior que zero.");
  }
  if (operadorId === contraparteId) {
    throw new ErroLedger("MESMA_CONTA", "Não dá para transferir para a própria conta.");
  }
  if (!SAI_DO_OPERADOR.has(tipo) && !ENTRA_NO_OPERADOR.has(tipo)) {
    throw new ErroLedger("SEM_PERMISSAO", "Tipo de transação inválido.");
  }
  if ((tipo === "dar" || tipo === "tomar") && !descricao) {
    throw new ErroLedger("DESCRICAO_OBRIGATORIA", "Descreva o objeto.");
  }

  return db.transaction(async (tx) => {
    const repetida = await buscarPorChave(tx, chaveIdempotencia, operadorId);
    if (repetida) return { transacao: repetida, repetida: true };

    const pessoas = await carregarPessoas(tx, [operadorId, contraparteId]);
    const operador = pessoas.get(operadorId);
    const contraparte = pessoas.get(contraparteId);
    if (!operador || !contraparte) {
      throw new ErroLedger("USUARIO_NAO_ENCONTRADO", "Essa pessoa ainda não tem conta.");
    }
    if (!operador.ativo || !contraparte.ativo) {
      throw new ErroLedger("CONTA_DESATIVADA", "Conta desativada.");
    }
    if (tipo !== "envio" && operador.papel === "usuario") {
      throw new ErroLedger("SEM_PERMISSAO", "Operação restrita ao Caixa.");
    }
    if (ENTRA_NO_OPERADOR.has(tipo) && operador.papel === "caixa" && contraparte.papel === "admin") {
      throw new ErroLedger("SEM_PERMISSAO", "O Caixa não pode tomar de um Admin.");
    }

    const saiDoOperador = SAI_DO_OPERADOR.has(tipo);
    const pagador = saiDoOperador ? operador : contraparte;
    const recebedor = saiDoOperador ? contraparte : operador;

    const contas = await travarContas(tx, [operadorId, contraparteId]);
    // Duas tentativas simultâneas com a mesma chave passam juntas pela checagem
    // do início; com as contas travadas, a segunda enxerga a primeira aqui.
    const concorrente = await buscarPorChave(tx, chaveIdempotencia, operadorId);
    if (concorrente) return { transacao: concorrente, repetida: true };
    const contaPagador = contas.get(pagador.id)!;
    const limite = limiteEfetivo(
      pagador.papel,
      contaPagador.limiteNegativo,
      await limitePadraoCaixa(tx),
    );
    const saldoResultante = contaPagador.saldo - valor;

    if (limite !== null && saldoResultante < -limite) {
      if (saiDoOperador) {
        const disponivel = Math.max(0, contaPagador.saldo + limite);
        throw new ErroLedger("SALDO_INSUFICIENTE", "Saldo insuficiente.", {
          disponivel,
          falta: valor - disponivel,
        });
      }
      if (!pedido.confirmarNegativo) {
        throw new ErroLedger(
          "CONFIRMACAO_NECESSARIA",
          "Essa operação deixa a pessoa com saldo negativo.",
          { saldoResultante },
        );
      }
    }

    const criada = await mover(tx, {
      tipo,
      deConta: pagador.id,
      paraConta: recebedor.id,
      valor,
      descricao,
      operadorId,
      chaveIdempotencia,
    });
    return { transacao: criada, repetida: false };
  });
}

export type PedidoEstorno = {
  operadorId: string;
  transacaoId: string;
  motivo: string;
  chaveIdempotencia: string;
};

/**
 * Cria a transação inversa. Não checa limite: desfazer um erro não pode
 * depender de a pessoa ainda ter o saldo, então ela pode ficar negativa.
 */
export async function estornar(
  db: Banco,
  pedido: PedidoEstorno,
): Promise<{ transacao: Transacao; repetida: boolean }> {
  const motivo = pedido.motivo.trim();
  if (!motivo) throw new ErroLedger("DESCRICAO_OBRIGATORIA", "Informe o motivo do estorno.");

  return db.transaction(async (tx) => {
    const repetida = await buscarPorChave(tx, pedido.chaveIdempotencia, pedido.operadorId);
    if (repetida) return { transacao: repetida, repetida: true };

    const [operador] = await tx
      .select({ papel: user.papel, ativo: user.ativo })
      .from(user)
      .where(eq(user.id, pedido.operadorId));
    if (!operador) throw new ErroLedger("USUARIO_NAO_ENCONTRADO", "Operador não encontrado.");
    if (!operador.ativo) throw new ErroLedger("CONTA_DESATIVADA", "Conta desativada.");
    if (operador.papel === "usuario") {
      throw new ErroLedger("SEM_PERMISSAO", "Estorno restrito a Caixa e Admin.");
    }

    const [original] = await tx
      .select()
      .from(transacao)
      .where(eq(transacao.id, pedido.transacaoId));
    if (!original) throw new ErroLedger("TRANSACAO_NAO_ENCONTRADA", "Transação não encontrada.");
    if (original.tipo === "estorno") {
      throw new ErroLedger("SEM_PERMISSAO", "Um estorno não pode ser estornado.");
    }
    if (operador.papel === "caixa" && original.operadorId !== pedido.operadorId) {
      throw new ErroLedger("SEM_PERMISSAO", "O Caixa só estorna as próprias operações.");
    }

    // Travar as contas também serializa dois estornos da mesma transação: o
    // segundo só lê `estornoDe` depois que o primeiro terminou.
    await travarContas(tx, [original.deConta, original.paraConta]);
    const concorrente = await buscarPorChave(tx, pedido.chaveIdempotencia, pedido.operadorId);
    if (concorrente) return { transacao: concorrente, repetida: true };
    const [jaEstornada] = await tx
      .select({ id: transacao.id })
      .from(transacao)
      .where(eq(transacao.estornoDe, original.id));
    if (jaEstornada) throw new ErroLedger("JA_ESTORNADA", "Essa transação já foi estornada.");

    const criada = await mover(tx, {
      tipo: "estorno",
      deConta: original.paraConta,
      paraConta: original.deConta,
      valor: original.valor,
      descricao: motivo,
      operadorId: pedido.operadorId,
      estornoDe: original.id,
      chaveIdempotencia: pedido.chaveIdempotencia,
    });
    await tx.insert(auditoria).values({
      atorId: pedido.operadorId,
      alvoId: original.deConta,
      acao: "estorno",
      detalhes: { transacaoOriginal: original.id, estorno: criada.id, motivo },
    });
    return { transacao: criada, repetida: false };
  });
}

/** Saldo, limite e quanto ainda dá para enviar. `disponivel` nulo = sem limite. */
export async function obterSaldo(db: Banco, usuarioId: string) {
  const [linha] = await db
    .select({
      papel: user.papel,
      saldo: conta.saldo,
      limiteNegativo: conta.limiteNegativo,
    })
    .from(user)
    .leftJoin(conta, eq(conta.usuarioId, user.id))
    .where(eq(user.id, usuarioId));
  if (!linha) throw new ErroLedger("USUARIO_NAO_ENCONTRADO", "Usuário não encontrado.");

  const saldo = linha.saldo ?? 0;
  const limite = limiteEfetivo(linha.papel, linha.limiteNegativo, await limitePadraoCaixa(db));
  return {
    saldo,
    limite,
    disponivel: limite === null ? null : Math.max(0, saldo + limite),
  };
}

/**
 * Auditoria do próprio livro: a soma dos saldos tem de ser zero e o saldo de
 * cada conta tem de bater com o histórico dela.
 */
export async function verificarIntegridade(db: Banco) {
  const [{ soma }] = await db
    .select({ soma: sql<number>`coalesce(sum(${conta.saldo}), 0)::int` })
    .from(conta);

  const divergentes = await db.execute<{ usuario_id: string; saldo: number; calculado: number }>(sql`
    select c.usuario_id, c.saldo, coalesce(m.total, 0)::int as calculado
    from ${conta} c
    left join (
      select conta_id, sum(delta) as total from (
        select ${transacao.paraConta} as conta_id, ${transacao.valor} as delta from ${transacao}
        union all
        select ${transacao.deConta}, -${transacao.valor} from ${transacao}
      ) movimentos group by conta_id
    ) m on m.conta_id = c.usuario_id
    where c.saldo <> coalesce(m.total, 0)
  `);

  const contasDivergentes = (
    "rows" in divergentes ? divergentes.rows : divergentes
  ) as { usuario_id: string; saldo: number; calculado: number }[];
  return { somaSaldos: soma, contasDivergentes, integro: soma === 0 && contasDivergentes.length === 0 };
}
