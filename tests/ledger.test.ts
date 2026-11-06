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
    expect(await saldo("caixa")).toBe(-100);
    expect(await saldo("admin")).toBe(-7);
    expect(await verificarIntegridade(db)).toMatchObject({ somaSaldos: 0, integro: true });
  });

  it("detecta saldo adulterado fora do livro", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x" });
    await db.update(schema.conta).set({ saldo: 999 }).where(eq(schema.conta.usuarioId, "ana"));
    const r = await verificarIntegridade(db);
    expect(r.integro).toBe(false);
    expect(r.contasDivergentes).toEqual([{ usuario_id: "ana", saldo: 999, calculado: 10 }]);
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
    await mover({ operadorId: "admin", contraparteId: "caixa", tipo: "tomar", valor: 1, descricao: "x" });
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

  it("Caixa distribui até −1000 e nem um a mais", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 1000, descricao: "x" });
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 1, descricao: "x" }));
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "deposito_cedula", valor: 1 }));
    expect(await obterSaldo(db, "caixa")).toEqual({ saldo: -1000, limite: 1000, disponivel: 0 });
  });

  it("o padrão global do Caixa é configurável", async () => {
    await db.insert(schema.configuracao).values({ chave: CHAVE_LIMITE_CAIXA, valor: 50 });
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 51, descricao: "x" }));
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 50, descricao: "x" });
  });

  it("limite individual vence o padrão, para Caixa e para usuário", async () => {
    await db.insert(schema.conta).values([
      { usuarioId: "caixa", limiteNegativo: 2000 },
      { usuarioId: "ana", limiteNegativo: 40 },
    ]);
    await mover({ operadorId: "caixa", contraparteId: "bia", tipo: "dar", valor: 2000, descricao: "x" });
    await mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 40 });
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 1 }));
    expect(await saldo("ana")).toBe(-40);
  });

  it("Admin não tem limite", async () => {
    await mover({ operadorId: "admin", contraparteId: "ana", tipo: "dar", valor: 1_000_000, descricao: "x" });
    expect(await obterSaldo(db, "admin")).toEqual({ saldo: -1_000_000, limite: null, disponivel: null });
  });

  it("Tomar que deixa a pessoa negativa pede confirmação e depois passa", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x" });
    const erro = await espera("CONFIRMACAO_NECESSARIA", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "tomar", valor: 25, descricao: "casaco" }));
    expect(erro.dados).toEqual({ saldoResultante: -15 });
    expect(await saldo("ana")).toBe(10);

    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "tomar", valor: 25, descricao: "casaco", confirmarNegativo: true });
    expect(await saldo("ana")).toBe(-15);
    // Negativa, a pessoa não consegue enviar.
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "ana", contraparteId: "bia", tipo: "envio", valor: 1 }));
  });

  it("Tomar dentro do saldo não pede confirmação", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 10, descricao: "x" });
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "saque_cedula", valor: 10 });
    expect(await saldo("ana")).toBe(0);
  });

  it("Caixa rebaixado com saldo negativo fica impedido de enviar", async () => {
    await mover({ operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 300, descricao: "x" });
    await db.update(schema.user).set({ papel: "usuario" }).where(eq(schema.user.id, "caixa"));
    await espera("SALDO_INSUFICIENTE", mover({ operadorId: "caixa", contraparteId: "ana", tipo: "envio", valor: 1 }));
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
    expect(await saldo("caixa")).toBe(0);
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
