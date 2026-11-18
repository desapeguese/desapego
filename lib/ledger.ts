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
 * - cada transação debita um saldo e credita outro no mesmo valor, então a
 *   soma de todos os saldos é sempre zero;
 * - cada pessoa tem dois saldos na mesma conta: o pessoal e o de caixa. As
 *   operações de balcão (dar, tomar, cédulas) movem o saldo de caixa de quem
 *   opera e o saldo pessoal da outra pessoa; envios movem só saldos pessoais;
 * - o saldo pessoal não fica negativo (só o do Admin, que não tem limite); o
 *   saldo de caixa pode, até o limite do Caixa;
 * - transações nunca são alteradas, só estornadas. O estorno é a única
 *   operação que pode deixar alguém negativo sem querer: desfazer um erro não
 *   pode depender de a pessoa ainda ter o saldo.
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
  | "SALDO_DA_PESSOA_INSUFICIENTE"
  | "TRANSACAO_NAO_ENCONTRADA"
  | "JA_ESTORNADA"
  | "CHAVE_REUTILIZADA";

export class ErroLedger extends Error {
  constructor(
    public codigo: CodigoErro,
    mensagem: string,
    /** Números para a tela explicar o erro (quanto há disponível, quanto falta). */
    public dados: Record<string, number> = {},
  ) {
    super(mensagem);
    this.name = "ErroLedger";
  }
}

export type Transacao = typeof transacao.$inferSelect;

/** Tipos em que o valor sai de quem opera. */
const SAI_DO_OPERADOR = new Set<TipoTransacao>(["envio", "dar", "deposito_cedula"]);
/** Tipos em que o valor sai da outra pessoa e entra em quem opera. */
const ENTRA_NO_OPERADOR = new Set<TipoTransacao>(["tomar", "saque_cedula"]);
/** Operações de balcão: a ponta de quem opera é o saldo de caixa. */
const DE_BALCAO = new Set<TipoTransacao>(["dar", "tomar", "deposito_cedula", "saque_cedula"]);

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

/** Quanto o saldo pessoal pode ficar abaixo de zero. `null` = sem limite. */
const limitePessoal = (papel: Papel): number | null => (papel === "admin" ? null : 0);

/** Quanto o saldo de caixa pode ficar abaixo de zero. `null` = sem limite. */
function limiteDoCaixa(papel: Papel, limiteDaConta: number | null, padrao: number): number | null {
  if (papel === "admin") return null;
  return limiteDaConta ?? padrao;
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
  const sai = dados.deCaixa ? conta.saldoCaixa : conta.saldo;
  const entra = dados.paraCaixa ? conta.saldoCaixa : conta.saldo;
  await tx
    .update(conta)
    .set({ [dados.deCaixa ? "saldoCaixa" : "saldo"]: sql`${sai} - ${dados.valor}`, atualizadaEm: sql`now()` })
    .where(eq(conta.usuarioId, dados.deConta));
  await tx
    .update(conta)
    .set({ [dados.paraCaixa ? "saldoCaixa" : "saldo"]: sql`${entra} + ${dados.valor}`, atualizadaEm: sql`now()` })
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
  tipo: Exclude<TipoTransacao, "estorno" | "fechamento_caixa">;
  valor: number;
  descricao?: string;
  chaveIdempotencia: string;
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
    const deBalcao = DE_BALCAO.has(tipo);
    if (deBalcao && operador.papel === "usuario") {
      throw new ErroLedger("SEM_PERMISSAO", "Operação restrita ao Caixa.");
    }
    if (ENTRA_NO_OPERADOR.has(tipo) && operador.papel === "caixa" && contraparte.papel === "admin") {
      throw new ErroLedger("SEM_PERMISSAO", "O Caixa não pode receber nem sacar de um Admin.");
    }

    const saiDoOperador = SAI_DO_OPERADOR.has(tipo);
    const pagador = saiDoOperador ? operador : contraparte;
    const recebedor = saiDoOperador ? contraparte : operador;
    // No balcão, a ponta de quem opera é o saldo de caixa; a outra, o pessoal.
    const deCaixa = deBalcao && saiDoOperador;
    const paraCaixa = deBalcao && !saiDoOperador;

    const contas = await travarContas(tx, [operadorId, contraparteId]);
    // Duas tentativas simultâneas com a mesma chave passam juntas pela checagem
    // do início; com as contas travadas, a segunda enxerga a primeira aqui.
    const concorrente = await buscarPorChave(tx, chaveIdempotencia, operadorId);
    if (concorrente) return { transacao: concorrente, repetida: true };

    const contaPagador = contas.get(pagador.id)!;
    const saldoAtual = deCaixa ? contaPagador.saldoCaixa : contaPagador.saldo;
    const limite = deCaixa
      ? limiteDoCaixa(pagador.papel, contaPagador.limiteNegativo, await limitePadraoCaixa(tx))
      : limitePessoal(pagador.papel);

    if (limite !== null && saldoAtual - valor < -limite) {
      const disponivel = Math.max(0, saldoAtual + limite);
      const dados = { disponivel, falta: valor - disponivel };
      // Quem não tem saldo é quem opera (envio, pagar) ou a pessoa atendida
      // (receber, saque): a tela precisa dizer qual dos dois.
      throw saiDoOperador
        ? new ErroLedger("SALDO_INSUFICIENTE", "Saldo insuficiente.", dados)
        : new ErroLedger("SALDO_DA_PESSOA_INSUFICIENTE", "A pessoa não tem saldo suficiente.", dados);
    }

    const criada = await mover(tx, {
      tipo,
      deConta: pagador.id,
      paraConta: recebedor.id,
      deCaixa,
      paraCaixa,
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
 * Cria a transação inversa, devolvendo o valor aos mesmos saldos de onde saiu.
 * Não checa limite: desfazer um erro não pode depender de a pessoa ainda ter o
 * saldo, então ela pode ficar negativa.
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
    if (original.tipo === "fechamento_caixa") {
      throw new ErroLedger("SEM_PERMISSAO", "Um fechamento de caixa não pode ser estornado.");
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
      deCaixa: original.paraCaixa,
      paraCaixa: original.deCaixa,
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

/**
 * Zera o saldo de caixa de quem deixou de ser Caixa, passando-o (negativo ou
 * positivo) ao saldo de caixa do Admin que tirou o perfil. Roda dentro da
 * transação de banco de quem chama, junto com a mudança de perfil. Devolve a
 * transação criada, ou `null` se o saldo de caixa já era zero.
 */
export async function fecharCaixa(
  tx: Banco,
  dados: { alvoId: string; adminId: string },
): Promise<Transacao | null> {
  const t = tx as unknown as Tx;
  const contas = await travarContas(t, [dados.alvoId, dados.adminId]);
  const saldoCaixa = contas.get(dados.alvoId)!.saldoCaixa;
  if (saldoCaixa === 0) return null;
  const devedor = saldoCaixa < 0;
  return mover(t, {
    tipo: "fechamento_caixa",
    // Caixa negativo: o Admin cobre. Positivo: o Admin recolhe.
    deConta: devedor ? dados.adminId : dados.alvoId,
    paraConta: devedor ? dados.alvoId : dados.adminId,
    deCaixa: true,
    paraCaixa: true,
    valor: Math.abs(saldoCaixa),
    descricao: "Fechamento de caixa",
    operadorId: dados.adminId,
    chaveIdempotencia: `fechamento:${dados.alvoId}:${crypto.randomUUID()}`,
  });
}

/**
 * Os dois saldos de uma pessoa e o número sequencial da conta.
 * `disponivel` e `disponivelCaixa` nulos = sem limite (Admin).
 */
export async function obterSaldo(db: Banco, usuarioId: string) {
  const ler = () =>
    db
      .select({
        papel: user.papel,
        numero: conta.numero,
        saldo: conta.saldo,
        saldoCaixa: conta.saldoCaixa,
        limiteNegativo: conta.limiteNegativo,
      })
      .from(user)
      .leftJoin(conta, eq(conta.usuarioId, user.id))
      .where(eq(user.id, usuarioId));

  let [linha] = await ler();
  if (!linha) throw new ErroLedger("USUARIO_NAO_ENCONTRADO", "Usuário não encontrado.");
  if (linha.numero === null) {
    // A conta nasce junto com a pessoa (lib/auth.ts); isto cobre quem foi
    // criado por outro caminho.
    await db.insert(conta).values({ usuarioId }).onConflictDoNothing();
    [linha] = await ler();
  }

  const saldo = linha.saldo ?? 0;
  const saldoCaixa = linha.saldoCaixa ?? 0;
  const limiteCaixa = limiteDoCaixa(linha.papel, linha.limiteNegativo, await limitePadraoCaixa(db));
  return {
    numero: linha.numero ?? 0,
    /** Saldo pessoal e quanto dele dá para enviar. */
    saldo,
    disponivel: limitePessoal(linha.papel) === null ? null : Math.max(0, saldo),
    /** Saldo do modo Caixa, o limite dele e quanto ainda dá para distribuir. */
    saldoCaixa,
    limiteCaixa,
    disponivelCaixa: limiteCaixa === null ? null : Math.max(0, saldoCaixa + limiteCaixa),
  };
}

/**
 * Auditoria do próprio livro: a soma de todos os saldos (pessoais e de caixa)
 * tem de ser zero, e cada saldo tem de bater com o histórico dele.
 */
export async function verificarIntegridade(db: Banco) {
  const [{ soma }] = await db
    .select({ soma: sql<number>`coalesce(sum(${conta.saldo} + ${conta.saldoCaixa}), 0)::int` })
    .from(conta);

  const divergentes = await db.execute(sql`
    select c.usuario_id, c.saldo, coalesce(m.pessoal, 0)::int as calculado,
           c.saldo_caixa, coalesce(m.caixa, 0)::int as calculado_caixa
    from ${conta} c
    left join (
      select conta_id,
             sum(delta) filter (where not caixa) as pessoal,
             sum(delta) filter (where caixa) as caixa
      from (
        select t.para_conta as conta_id, t.para_caixa as caixa, t.valor as delta from ${transacao} t
        union all
        select t.de_conta, t.de_caixa, -t.valor from ${transacao} t
      ) movimentos group by conta_id
    ) m on m.conta_id = c.usuario_id
    where c.saldo <> coalesce(m.pessoal, 0) or c.saldo_caixa <> coalesce(m.caixa, 0)
  `);

  const contasDivergentes = ("rows" in divergentes ? divergentes.rows : divergentes) as unknown as {
    usuario_id: string;
    saldo: number;
    calculado: number;
    saldo_caixa: number;
    calculado_caixa: number;
  }[];
  return { somaSaldos: soma, contasDivergentes, integro: soma === 0 && contasDivergentes.length === 0 };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export type LinhaExtrato = {
  id: string;
  criadaEm: Date;
  tipo: TipoTransacao;
  /** Positivo quando entrou na conta, negativo quando saiu. */
  valor: number;
  descricao: string;
  contraparteId: string;
  contraparteNome: string;
  /** A outra ponta foi o saldo de caixa de alguém (uma operação de balcão). */
  contraparteNoCaixa: boolean;
  estornoDe: string | null;
};

/**
 * Extrato de uma conta, do mais recente para o mais antigo. `cursor` é o
 * `proximo` devolvido pela página anterior.
 */
export async function listarExtrato(
  db: Banco,
  usuarioId: string,
  opcoes: {
    limite?: number;
    cursor?: string | null;
    /** O extrato do saldo pessoal (padrão) ou o do modo Caixa. */
    lado?: "pessoal" | "caixa";
  } = {},
): Promise<{ linhas: LinhaExtrato[]; proximo: string | null }> {
  const limite = Math.min(Math.max(opcoes.limite ?? 20, 1), 100);
  const caixa = opcoes.lado === "caixa";

  // O cursor é "instante|id". O instante vem do próprio banco como texto, com
  // os microssegundos, porque um Date do JavaScript os perderia e a paginação
  // pularia ou repetiria linhas criadas no mesmo milissegundo.
  let aPartirDe = sql`true`;
  if (opcoes.cursor) {
    const [instante, id] = opcoes.cursor.split("|");
    if (!instante || !id || Number.isNaN(Date.parse(instante)) || !/^[0-9a-f-]{36}$/.test(id)) {
      return { linhas: [], proximo: null };
    }
    aPartirDe = sql`(t.criada_em, t.id) < (${instante}::timestamptz, ${id}::uuid)`;
  }

  const resultado = await db.execute(sql`
    select t.id, t.criada_em, t.criada_em::text as cursor_instante, t.tipo, t.valor,
           t.descricao, t.estorno_de, t.de_conta, t.para_conta, t.de_caixa, t.para_caixa,
           de.name as de_nome, para.name as para_nome
    from ${transacao} t
    join ${user} de on de.id = t.de_conta
    join ${user} para on para.id = t.para_conta
    where ((t.de_conta = ${usuarioId} and t.de_caixa = ${caixa})
        or (t.para_conta = ${usuarioId} and t.para_caixa = ${caixa})) and ${aPartirDe}
    order by t.criada_em desc, t.id desc
    limit ${limite + 1}
  `);
  type Bruta = {
    id: string;
    criada_em: Date | string;
    cursor_instante: string;
    tipo: TipoTransacao;
    valor: number;
    descricao: string;
    estorno_de: string | null;
    de_conta: string;
    para_conta: string;
    de_caixa: boolean;
    para_caixa: boolean;
    de_nome: string;
    para_nome: string;
  };
  const brutas = ("rows" in resultado ? resultado.rows : resultado) as unknown as Bruta[];

  const pagina = brutas.slice(0, limite);
  const ultima = pagina.at(-1);
  return {
    linhas: pagina.map((b) => {
      const entrou = b.para_conta === usuarioId && b.para_caixa === caixa;
      return {
        id: b.id,
        criadaEm: new Date(b.criada_em),
        tipo: b.tipo,
        valor: entrou ? b.valor : -b.valor,
        descricao: b.descricao,
        contraparteId: entrou ? b.de_conta : b.para_conta,
        contraparteNome: entrou ? b.de_nome : b.para_nome,
        contraparteNoCaixa: entrou ? b.de_caixa : b.para_caixa,
        estornoDe: b.estorno_de,
      };
    }),
    proximo: brutas.length > limite && ultima ? `${ultima.cursor_instante}|${ultima.id}` : null,
  };
}

/** Uma transação, vista por uma das duas pontas. `null` se a pessoa não participa. */
export async function obterTransacaoDe(
  db: Banco,
  usuarioId: string,
  transacaoId: string,
): Promise<LinhaExtrato | null> {
  if (!/^[0-9a-f-]{36}$/.test(transacaoId)) return null;
  const [t] = await db.select().from(transacao).where(eq(transacao.id, transacaoId));
  if (!t || (t.deConta !== usuarioId && t.paraConta !== usuarioId)) return null;

  const entrou = t.paraConta === usuarioId;
  const contraparteId = entrou ? t.deConta : t.paraConta;
  const [contraparte] = await db
    .select({ nome: user.name })
    .from(user)
    .where(eq(user.id, contraparteId));
  return {
    id: t.id,
    criadaEm: t.criadaEm,
    tipo: t.tipo,
    valor: entrou ? t.valor : -t.valor,
    descricao: t.descricao,
    contraparteId,
    contraparteNome: contraparte?.nome ?? "",
    contraparteNoCaixa: entrou ? t.deCaixa : t.paraCaixa,
    estornoDe: t.estornoDe,
  };
}

// ---------------------------------------------------------------------------
// Leitura para Caixa e Admin
// ---------------------------------------------------------------------------

export type TransacaoCompleta = Transacao & {
  deNome: string;
  paraNome: string;
  operadorNome: string;
  /** Id do estorno desta transação, se já houve. */
  estornadaPor: string | null;
};

async function completar(db: Banco, filtro: ReturnType<typeof sql>, limite: number) {
  const resultado = await db.execute(sql`
    select t.id, t.criada_em, t.tipo, t.de_conta, t.para_conta, t.de_caixa, t.para_caixa, t.valor, t.descricao,
           t.operador_id, t.estorno_de, t.chave_idempotencia,
           de.name as de_nome, para.name as para_nome, op.name as operador_nome,
           (select e.id from ${transacao} e where e.estorno_de = t.id) as estornada_por
    from ${transacao} t
    join ${user} de on de.id = t.de_conta
    join ${user} para on para.id = t.para_conta
    join ${user} op on op.id = t.operador_id
    where ${filtro}
    order by t.criada_em desc
    limit ${limite}
  `);
  const linhas = ("rows" in resultado ? resultado.rows : resultado) as unknown as Record<string, never>[];
  return linhas.map(
    (l): TransacaoCompleta => ({
      id: l.id,
      criadaEm: new Date(l.criada_em),
      tipo: l.tipo,
      deConta: l.de_conta,
      paraConta: l.para_conta,
      deCaixa: l.de_caixa,
      paraCaixa: l.para_caixa,
      valor: l.valor,
      descricao: l.descricao,
      operadorId: l.operador_id,
      estornoDe: l.estorno_de,
      chaveIdempotencia: l.chave_idempotencia,
      deNome: l.de_nome,
      paraNome: l.para_nome,
      operadorNome: l.operador_nome,
      estornadaPor: l.estornada_por,
    }),
  );
}

/** Uma transação com os nomes das pontas e de quem operou. Sem checar quem pede. */
export async function obterTransacaoCompleta(db: Banco, id: string): Promise<TransacaoCompleta | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [achada] = await completar(db, sql`t.id = ${id}::uuid`, 1);
  return achada ?? null;
}

/**
 * Acha transações pelo número curto do comprovante ("910A-86B5"): os oito
 * primeiros dígitos do id. Em geral devolve uma; mais de uma é coincidência
 * rara, e o Caixa escolhe pela data e pelas pessoas.
 */
export async function buscarTransacoesPorNumero(db: Banco, numero: string): Promise<TransacaoCompleta[]> {
  const hex = numero.replace(/[^0-9a-f]/gi, "").toLowerCase();
  if (hex.length !== 8) return [];
  return completar(db, sql`t.id::text like ${hex + "%"}`, 5);
}

/** Quem pode estornar: o Admin, qualquer uma; o Caixa, só as que ele operou. */
export function podeEstornar(
  ator: { id: string; papel: Papel },
  t: Pick<TransacaoCompleta, "tipo" | "operadorId" | "estornadaPor">,
): boolean {
  if (t.tipo === "estorno" || t.tipo === "fechamento_caixa" || t.estornadaPor) return false;
  return ator.papel === "admin" || (ator.papel === "caixa" && t.operadorId === ator.id);
}
