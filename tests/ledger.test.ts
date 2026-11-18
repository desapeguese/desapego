import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { Banco } from "../lib/db";
import * as schema from "../lib/db/schema";
import {
  CHAVE_LIMITE_CAIXA,
  ErroLedger,
  estornar,
  fecharCaixa,
  listarExtrato,
  obterTransacaoDe,
  obterSaldo,
  transferir,
  verificarIntegridade,
  type PedidoTransferencia,
} from "../lib/ledger";

let db: Banco;
let n = 0;
const chave = () => `teste-${++n}`;

async function pessoa(id: string, papel: schema.Papel = "usuario", ativo = true) {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@teste.br`, papel, ativo });
}

const mover = (p: Omit<PedidoTransferencia, "chaveIdempotencia"> & { chaveIdempotencia?: string }) =>
  transferir(db, { chaveIdempotencia: chave(), ...p });

const saldo = async (id: string) => (await obterSaldo(db, id)).saldo;
const saldoCaixa = async (id: string) => (await obterSaldo(db, id)).saldoCaixa;

async function espera(codigo: string, promessa: Promise<unknown>) {
  const erro = await promessa.then(
    () => null,
    (e) => e,
  );
  expect(erro).toBeInstanceOf(ErroLedger);
  expect((erro as ErroLedger).codigo).toBe(codigo);
  return erro as ErroLedger;
}

beforeEach(async () => {
  const cliente = new PGlite();
  const banco = drizzle(cliente, { schema });
  await migrate(banco, { migrationsFolder: "./drizzle" });
  db = banco;
  await pessoa("ana");
  await pessoa("bia");
  await pessoa("caixa", "caixa");
  await pessoa("admin", "admin");
});

describe("soma zero", () => {
  it("mantém a soma dos saldos em zero depois de vários movimentos", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 120, descricao: "bicicleta" });
    await mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 50 });
    await mover({ operadorId: "caixa", contraparteId: "bia", tipo: "tomar", valor: 20, descricao: "livro" });
    await mover({ operadorId: "admin", contraparteId: "ana", tipo: "deposito_cedula", valor: 7 });

    expect(await saldo("ana")).toBe(77);
    expect(await saldo("bia")).toBe(30);
    // O balcão mexe no saldo de caixa de quem opera; o pessoal fica intacto.
    expect(await saldo("caixa")).toBe(0);
    expect(await saldoCaixa("caixa")).toBe(-100);
    expect(await saldo("admin")).toBe(0);
    expect(await saldoCaixa("admin")).toBe(-7);
    expect(await verificarIntegridade(db)).toMatchObject({ somaSaldos: 0, integro: true });
  });

  it("detecta saldo adulterado fora do livro", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x" });
    await db.update(schema.conta).set({ saldo: 999 }).where(eq(schema.conta.usuarioId, "ana"));
    const r = await verificarIntegridade(db);
    expect(r.integro).toBe(false);
    expect(r.contasDivergentes).toMatchObject([{ usuario_id: "ana", saldo: 999, calculado: 10 }]);
    await db.update(schema.conta).set({ saldo: 10, saldoCaixa: 5 }).where(eq(schema.conta.usuarioId, "ana"));
    expect((await verificarIntegridade(db)).contasDivergentes).toMatchObject([
      { usuario_id: "ana", saldo_caixa: 5, calculado_caixa: 0 },
    ]);
  });

  it("o banco recusa alterar ou apagar uma transação", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x" });
    await expect(db.update(schema.transacao).set({ valor: 1 })).rejects.toThrow();
    await expect(db.delete(schema.transacao)).rejects.toThrow();
  });
});

describe("validação", () => {
  it.each([0, -5, 1.5, Number.NaN])("recusa valor %s", async (valor) => {
    await espera("VALOR_INVALIDO", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor, descricao: "x" }));
  });

  it("recusa transferir para si", async () => {
    await espera("MESMA_CONTA", mover({ operadorId: "ana", contraparteId: "ana", tipo: "envio", valor: 1 }));
  });

  it("recusa destinatário sem conta", async () => {
    await espera("USUARIO_NAO_ENCONTRADO", mover({ operadorId: "caixa", contraparteId: "ninguem", tipo: "dar", valor: 1, descricao: "x" }));
  });

  it("recusa conta desativada nas duas pontas", async () => {
    await pessoa("inativa", "usuario", false);
    await espera("CONTA_DESATIVADA", mover({ operadorId: "caixa", contraparteId: "inativa", tipo: "dar", valor: 1, descricao: "x" }));
    await espera("CONTA_DESATIVADA", mover({ operadorId: "inativa", contraparteId: "ana", tipo: "envio", valor: 1 }));
  });

  it("exige descrição em Dar e Tomar, mas não em envio", async () => {
    await espera("DESCRICAO_OBRIGATORIA", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 5, descricao: "  " }));
    await espera("DESCRICAO_OBRIGATORIA", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "tomar", valor: 5 }));
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 5, descricao: "x" });
    await mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 5 });
  });

  it("descreve cédulas automaticamente", async () => {
    const { transacao } = await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "deposito_cedula", valor: 5 });
    expect(transacao.descricao).toBe("Depósito de cédulas");
  });
});

describe("permissões", () => {
  it("usuário comum só faz envio", async () => {
    for (const tipo of ["dar", "tomar", "deposito_cedula", "saque_cedula"] as const) {
      await espera("SEM_PERMISSAO", mover({ operadorId: "ana", contraparteId: "bia", tipo, valor: 1, descricao: "x" }));
    }
  });

  it("Caixa não toma nem saca de Admin; Admin toma de qualquer um", async () => {
    await espera("SEM_PERMISSAO", mover({ operadorId: "caixa", contraparteId: "admin", tipo: "tomar", valor: 1, descricao: "x" }));
    await espera("SEM_PERMISSAO", mover({ operadorId: "caixa", contraparteId: "admin", tipo: "saque_cedula", valor: 1 }));
    await pessoa("admin2", "admin");
    await mover({ operadorId: "admin", contraparteId: "admin2", tipo: "tomar", valor: 1, descricao: "x" });
    await mover({ operadorId: "admin", contraparteId: "ana", tipo: "dar", valor: 1, descricao: "x" });
    await mover({ operadorId: "admin", contraparteId: "ana", tipo: "tomar", valor: 1, descricao: "x" });
  });
});

describe("limites", () => {
  it("usuário não envia mais do que tem, e o erro diz quanto falta", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 30, descricao: "x" });
    const erro = await espera("SALDO_INSUFICIENTE", mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 31 }));
    expect(erro.dados).toEqual({ disponivel: 30, falta: 1 });
    await mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 30 });
    expect(await saldo("ana")).toBe(0);
  });

  it("Caixa distribui até −1000 do saldo de caixa e nem um a mais", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 1000, descricao: "x" });
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 1, descricao: "x" }));
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "deposito_cedula", valor: 1 }));
    expect(await obterSaldo(db, "caixa")).toMatchObject({ saldo: 0, disponivel: 0, saldoCaixa: -1000, limiteCaixa: 1000, disponivelCaixa: 0 });
  });

  it("os dois saldos não se misturam: o pessoal do Caixa não paga o balcão, e o limite do caixa não serve a envios", async () => {
    // O Caixa tem 50 pessoais (recebeu de outro Caixa, como qualquer participante).
    await pessoa("caixa2", "caixa");
    await mover({ operadorId: "caixa2", contraparteId: "caixa", tipo: "dar", valor: 50, descricao: "x" });
    expect(await obterSaldo(db, "caixa")).toMatchObject({ saldo: 50, saldoCaixa: 0, disponivelCaixa: 1000 });

    // No balcão ele usa só o saldo de caixa...
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 300, descricao: "x" });
    expect(await obterSaldo(db, "caixa")).toMatchObject({ saldo: 50, saldoCaixa: -300, disponivelCaixa: 700 });
    // ...e o que recebe no balcão volta para o saldo de caixa, não para o bolso.
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "tomar", valor: 100, descricao: "x" });
    expect(await obterSaldo(db, "caixa")).toMatchObject({ saldo: 50, saldoCaixa: -200 });

    // Como pessoa, só envia os 50 que são dele.
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "bia", tipo: "envio", valor: 51 }));
    await mover({ operadorId: "caixa", contraparteId: "bia", tipo: "envio", valor: 50 });
    expect(await obterSaldo(db, "caixa")).toMatchObject({ saldo: 0, saldoCaixa: -200 });
    expect((await verificarIntegridade(db)).integro).toBe(true);
  });

  it("o padrão global do Caixa é configurável", async () => {
    await db.insert(schema.configuracao).values({ chave: CHAVE_LIMITE_CAIXA, valor: 50 });
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 51, descricao: "x" }));
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 50, descricao: "x" });
  });

  it("limite individual vale para o saldo de caixa, nunca para o pessoal", async () => {
    await db.insert(schema.conta).values([
      { usuarioId: "caixa", limiteNegativo: 2000 },
      { usuarioId: "ana", limiteNegativo: 40 },
    ]);
    await mover({ operadorId: "caixa", contraparteId: "bia", tipo: "dar", valor: 2000, descricao: "x" });
    // Um limite gravado na conta de um usuário comum não lhe dá crédito.
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 1 }));
  });

  it("Admin não tem limite, nem no caixa nem no pessoal", async () => {
    await mover({ operadorId: "admin", contraparteId: "ana", tipo: "dar", valor: 1_000_000, descricao: "x" });
    await mover({ operadorId: "admin", contraparteId: "ana", tipo: "envio", valor: 10 });
    expect(await obterSaldo(db, "admin")).toMatchObject({ saldo: -10, disponivel: null, saldoCaixa: -1_000_000, limiteCaixa: null, disponivelCaixa: null });
  });

  it("no balcão ninguém fica negativo: Receber e saque além do saldo da pessoa são recusados", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x" });
    const erro = await espera("SALDO_DA_PESSOA_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "tomar", valor: 25, descricao: "casaco" }));
    expect(erro.dados).toEqual({ disponivel: 10, falta: 15 });
    await espera("SALDO_DA_PESSOA_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "saque_cedula", valor: 11 }));
    expect(await saldo("ana")).toBe(10);
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "saque_cedula", valor: 10 });
    expect(await saldo("ana")).toBe(0);
  });
});

describe("fechamento de caixa", () => {
  const fechar = (alvoId: string) => db.transaction((tx) => fecharCaixa(tx as unknown as Banco, { alvoId, adminId: "admin" }));

  it("caixa negativo é coberto pelo Admin; o saldo pessoal não muda", async () => {
    await pessoa("caixa2", "caixa");
    await mover({ operadorId: "caixa2", contraparteId: "caixa", tipo: "dar", valor: 50, descricao: "x" });
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 300, descricao: "x" });

    const t = await fechar("caixa");
    expect(t).toMatchObject({ tipo: "fechamento_caixa", deConta: "admin", paraConta: "caixa", deCaixa: true, paraCaixa: true, valor: 300, operadorId: "admin" });
    expect(await obterSaldo(db, "caixa")).toMatchObject({ saldo: 50, saldoCaixa: 0 });
    expect(await obterSaldo(db, "admin")).toMatchObject({ saldo: 0, saldoCaixa: -300 });
    expect((await verificarIntegridade(db)).integro).toBe(true);
  });

  it("caixa positivo é recolhido pelo Admin; zerado não gera transação", async () => {
    await mover({ operadorId: "admin", contraparteId: "ana", tipo: "dar", valor: 80, descricao: "x" });
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "tomar", valor: 80, descricao: "x" });
    expect(await saldoCaixa("caixa")).toBe(80);

    expect(await fechar("caixa")).toMatchObject({ deConta: "caixa", paraConta: "admin", valor: 80 });
    expect(await saldoCaixa("caixa")).toBe(0);
    expect(await saldoCaixa("admin")).toBe(0);
    expect(await fechar("caixa")).toBeNull();
  });

  it("não pode ser estornado", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 5, descricao: "x" });
    const t = await fechar("caixa");
    await espera("SEM_PERMISSAO", estornar(db, { operadorId: "admin", transacaoId: t!.id, motivo: "x", chaveIdempotencia: chave() }));
  });
});

describe("idempotência", () => {
  it("a mesma chave não vira duas transações", async () => {
    const pedido = { operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x", chaveIdempotencia: "toque-duplo" } as const;
    const a = await transferir(db, pedido);
    const b = await transferir(db, pedido);
    expect(a.repetida).toBe(false);
    expect(b.repetida).toBe(true);
    expect(b.transacao.id).toBe(a.transacao.id);
    expect(await saldo("ana")).toBe(10);
  });

  it("chave de outra pessoa é recusada", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x", chaveIdempotencia: "k" });
    await espera("CHAVE_REUTILIZADA", mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 1, chaveIdempotencia: "k" }));
  });

  it("falha no meio não deixa meio movimento", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x" });
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 11 }));
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.transacao);
    expect(total).toBe(1);
    expect((await verificarIntegridade(db)).integro).toBe(true);
  });
});

describe("estorno", () => {
  async function dar(valor = 40) {
    const { transacao } = await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor, descricao: "x" });
    return transacao;
  }
  const estorno = (operadorId: string, transacaoId: string, motivo = "valor errado") =>
    estornar(db, { operadorId, transacaoId, motivo, chaveIdempotencia: chave() });

  it("inverte a transação e registra na auditoria", async () => {
    const original = await dar();
    const { transacao } = await estorno("caixa", original.id);
    expect(transacao).toMatchObject({ tipo: "estorno", deConta: "ana", paraConta: "caixa", valor: 40, estornoDe: original.id });
    expect(await saldo("ana")).toBe(0);
    expect(await saldoCaixa("caixa")).toBe(0);
    expect(transacao).toMatchObject({ deCaixa: false, paraCaixa: true });
    const log = await db.select().from(schema.auditoria);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ atorId: "caixa", alvoId: "caixa", acao: "estorno" });
  });

  it("estorna mesmo que a pessoa já tenha gasto, deixando-a negativa", async () => {
    const original = await dar();
    await mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 40 });
    await estorno("caixa", original.id);
    expect(await saldo("ana")).toBe(-40);
    expect((await verificarIntegridade(db)).integro).toBe(true);
  });

  it("só uma vez, e estorno não se estorna", async () => {
    const original = await dar();
    const { transacao } = await estorno("caixa", original.id);
    await espera("JA_ESTORNADA", estorno("caixa", original.id));
    await espera("SEM_PERMISSAO", estorno("admin", transacao.id));
  });

  it("Caixa só estorna as próprias; Admin estorna qualquer uma; usuário nenhuma", async () => {
    const original = await dar();
    await pessoa("caixa2", "caixa");
    await espera("SEM_PERMISSAO", estorno("caixa2", original.id));
    await espera("SEM_PERMISSAO", estorno("ana", original.id));
    await estorno("admin", original.id);
  });

  it("exige motivo e transação existente", async () => {
    const original = await dar();
    await espera("DESCRICAO_OBRIGATORIA", estorno("caixa", original.id, " "));
    await espera("TRANSACAO_NAO_ENCONTRADA", estorno("caixa", "00000000-0000-0000-0000-000000000000"));
  });
});

describe("extrato", () => {
  it("mostra entradas e saídas com sinal, contraparte e ordem do mais recente", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 50, descricao: "bicicleta" });
    await mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 20, descricao: "carona" });
    const { linhas, proximo } = await listarExtrato(db, "ana");
    expect(proximo).toBeNull();
    expect(linhas.map((l) => [l.tipo, l.valor, l.contraparteNome, l.descricao])).toEqual([
      ["envio", -20, "bia", "carona"],
      ["dar", 50, "caixa", "bicicleta"],
    ]);
  });

  it("separa o extrato pessoal do extrato do modo Caixa", async () => {
    await pessoa("caixa2", "caixa");
    await mover({ operadorId: "caixa2", contraparteId: "caixa", tipo: "dar", valor: 50, descricao: "presente" });
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 30, descricao: "bicicleta" });
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "tomar", valor: 10, descricao: "livro" });

    const pessoal = await listarExtrato(db, "caixa");
    expect(pessoal.linhas.map((l) => [l.tipo, l.valor, l.contraparteNome, l.contraparteNoCaixa])).toEqual([["dar", 50, "caixa2", true]]);
    const doCaixa = await listarExtrato(db, "caixa", { lado: "caixa" });
    expect(doCaixa.linhas.map((l) => [l.tipo, l.valor, l.contraparteNome, l.contraparteNoCaixa])).toEqual([
      ["tomar", 10, "ana", false],
      ["dar", -30, "ana", false],
    ]);
    expect((await listarExtrato(db, "ana", { lado: "caixa" })).linhas).toEqual([]);
  });

  it("pagina sem pular nem repetir, e não mostra transações alheias", async () => {
    for (let i = 1; i <= 7; i++) {
      await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: i, descricao: `item ${i}` });
    }
    await mover({ operadorId: "caixa", contraparteId: "bia", tipo: "dar", valor: 99, descricao: "alheia" });

    const vistos: number[] = [];
    let cursor: string | null = null;
    do {
      const pagina = await listarExtrato(db, "ana", { limite: 3, cursor });
      vistos.push(...pagina.linhas.map((l) => l.valor));
      cursor = pagina.proximo;
    } while (cursor);
    expect(vistos).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(await listarExtrato(db, "ana", { cursor: "lixo" })).toEqual({ linhas: [], proximo: null });
  });

  it("só as duas pontas enxergam o detalhe de uma transação", async () => {
    const { transacao } = await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 5, descricao: "x" });
    expect(await obterTransacaoDe(db, "ana", transacao.id)).toMatchObject({ valor: 5, contraparteNome: "caixa" });
    expect(await obterTransacaoDe(db, "caixa", transacao.id)).toMatchObject({ valor: -5, contraparteNome: "ana" });
    expect(await obterTransacaoDe(db, "bia", transacao.id)).toBeNull();
    expect(await obterTransacaoDe(db, "ana", "não-é-uuid")).toBeNull();
  });
});

describe("número da conta", () => {
  it("é sequencial, único e existe mesmo para quem nunca transacionou", async () => {
    const numeros = [];
    for (const id of ["ana", "bia", "caixa", "admin"]) numeros.push((await obterSaldo(db, id)).numero);
    expect(new Set(numeros).size).toBe(4);
    expect(numeros.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    expect((await obterSaldo(db, "ana")).numero).toBe(numeros[0]);
  });
});
