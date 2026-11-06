import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { Banco } from "../lib/db";
import * as schema from "../lib/db/schema";
import { buscarTransacoesPorNumero, obterTransacaoCompleta, podeEstornar, estornar, transferir } from "../lib/ledger";
import {
  buscarPessoas,
  criarPessoa,
  definirAtivo,
  definirLimite,
  definirLimitePadraoCaixa,
  definirPapel,
  listarAuditoriaGlobal,
  listarEquipe,
  obterLimitePadraoCaixa,
  protecaoDaConta,
  removerSegundoFator,
  editarPessoa,
  ErroPessoa,
  listarAuditoria,
  obterPessoa,
  type Ator,
} from "../lib/pessoas";

let db: Banco;
const caixa: Ator = { id: "caixa", papel: "caixa" };
const admin: Ator = { id: "admin", papel: "admin" };
const ana: Ator = { id: "ana", papel: "usuario" };

async function pessoa(id: string, papel: schema.Papel = "usuario", extra: Partial<typeof schema.user.$inferInsert> = {}) {
  await db.insert(schema.user).values({ id, name: `${id} da Silva`, email: `${id}@teste.br`, papel, emailVerified: true, ...extra });
  await db.insert(schema.conta).values({ usuarioId: id });
}

async function espera(codigo: string, promessa: Promise<unknown>) {
  const erro = await promessa.then(() => null, (e) => e);
  expect(erro).toBeInstanceOf(ErroPessoa);
  expect((erro as ErroPessoa).codigo).toBe(codigo);
  return erro as ErroPessoa;
}

beforeEach(async () => {
  const banco = drizzle(new PGlite(), { schema });
  await migrate(banco, { migrationsFolder: "./drizzle" });
  db = banco;
  await pessoa("ana", "usuario", { telefone: "5511912345678" });
  await pessoa("caixa", "caixa");
  await pessoa("admin", "admin");
});

describe("cadastro pelo Caixa", () => {
  it("cria a pessoa com conta, sem e-mail verificado e sem termos aceitos", async () => {
    const { id } = await criarPessoa(db, caixa, { nome: "  Bia   Souza ", email: "Bia@Teste.BR", telefone: "(11) 98888-7777" });
    const bia = await obterPessoa(db, caixa, id);
    expect(bia).toMatchObject({ nome: "Bia Souza", email: "bia@teste.br", telefone: "5511988887777", papel: "usuario", ativo: true, saldo: 0, termosAceitosEm: null });
    expect(bia!.numero).toBeGreaterThan(0);
    const [bruta] = await db.select().from(schema.user).where(eq(schema.user.id, id));
    expect(bruta.emailVerified).toBe(false);
    expect(await listarAuditoria(db, caixa, id)).toMatchObject([{ acao: "cadastrada_pelo_caixa", atorNome: "caixa da Silva" }]);

    // Já pode receber.
    await transferir(db, { operadorId: "caixa", contraparteId: id, tipo: "dar", valor: 10, descricao: "livro", chaveIdempotencia: "k1" });
    expect((await obterPessoa(db, caixa, id))!.saldo).toBe(10);
  });

  it("recusa dados inválidos, e-mail repetido e quem não é da equipe", async () => {
    await espera("NOME_INVALIDO", criarPessoa(db, caixa, { nome: "Bia", email: "b@t.br", telefone: "" }));
    await espera("EMAIL_INVALIDO", criarPessoa(db, caixa, { nome: "Bia Souza", email: "sem-arroba", telefone: "" }));
    await espera("TELEFONE_INVALIDO", criarPessoa(db, caixa, { nome: "Bia Souza", email: "b@t.br", telefone: "123" }));
    const erro = await espera("EMAIL_EM_USO", criarPessoa(db, caixa, { nome: "Outra Ana", email: "ANA@teste.br", telefone: "" }));
    expect(erro.pessoaId).toBe("ana");
    await espera("SEM_PERMISSAO", criarPessoa(db, ana, { nome: "Bia Souza", email: "b@t.br", telefone: "" }));
  });
});

describe("busca", () => {
  it("acha por nome, e-mail, telefone e número da conta", async () => {
    const ids = async (termo: string) => (await buscarPessoas(db, caixa, termo)).map((p) => p.id);
    expect(await ids("ANA da")).toEqual(["ana"]);
    expect(await ids("caixa@teste")).toEqual(["caixa"]);
    expect(await ids("91234-5678")).toEqual(["ana"]);
    const { numero } = (await obterPessoa(db, caixa, "ana"))!;
    expect(await ids(`DES-2026-${String(numero).padStart(5, "0")}`)).toEqual(["ana"]);
    expect(await ids(String(numero))).toContain("ana");
    expect(await ids("")).toHaveLength(3);
    expect(await ids("ninguém")).toEqual([]);
  });

  it("trata % e _ como texto, não como curinga", async () => {
    expect(await buscarPessoas(db, caixa, "%")).toEqual([]);
    expect(await buscarPessoas(db, caixa, "a_a")).toEqual([]);
  });

  it("é só para a equipe", async () => {
    await espera("SEM_PERMISSAO", buscarPessoas(db, ana, ""));
    await espera("SEM_PERMISSAO", obterPessoa(db, ana, "caixa"));
    await espera("SEM_PERMISSAO", listarAuditoria(db, ana, "ana"));
  });
});

describe("edição", () => {
  it("registra o que mudou, de quê para quê", async () => {
    const { alteracoes } = await editarPessoa(db, caixa, "ana", { nome: "Ana Maria da Silva", email: "ana@teste.br", telefone: "11912345678" });
    expect(alteracoes).toEqual({ nome: { de: "ana da Silva", para: "Ana Maria da Silva" } });
    const [log] = await listarAuditoria(db, caixa, "ana");
    expect(log).toMatchObject({ acao: "dados_alterados", detalhes: alteracoes, atorNome: "caixa da Silva" });
  });

  it("sem mudança não grava nada", async () => {
    const { alteracoes } = await editarPessoa(db, caixa, "ana", { nome: "ana da Silva", email: "ANA@teste.br", telefone: "(11) 91234-5678" });
    expect(alteracoes).toEqual({});
    expect(await listarAuditoria(db, caixa, "ana")).toEqual([]);
  });

  it("trocar o e-mail derruba sessões e vínculos e exige nova prova do endereço", async () => {
    await db.insert(schema.session).values({ id: "s1", token: "t1", userId: "ana", expiresAt: new Date(Date.now() + 1e6) });
    await db.insert(schema.account).values({ id: "a1", accountId: "google-ana", providerId: "google", userId: "ana" });

    const { alteracoes, emailAntigo } = await editarPessoa(db, caixa, "ana", { nome: "ana da Silva", email: "nova@teste.br", telefone: "11912345678" });
    expect(emailAntigo).toBe("ana@teste.br");
    expect(alteracoes.email).toEqual({ de: "ana@teste.br", para: "nova@teste.br" });
    expect(await db.select().from(schema.session)).toEqual([]);
    expect(await db.select().from(schema.account)).toEqual([]);
    const [bruta] = await db.select().from(schema.user).where(eq(schema.user.id, "ana"));
    expect(bruta).toMatchObject({ email: "nova@teste.br", emailVerified: false });
  });

  it("não deixa usar o e-mail de outra pessoa", async () => {
    await espera("EMAIL_EM_USO", editarPessoa(db, caixa, "ana", { nome: "ana da Silva", email: "caixa@teste.br", telefone: "" }));
  });

  it("Caixa não edita Caixa nem Admin; Admin edita qualquer um", async () => {
    await pessoa("caixa2", "caixa");
    const dados = { nome: "Nome Novo", email: "x@teste.br", telefone: "" };
    await espera("SEM_PERMISSAO", editarPessoa(db, caixa, "caixa2", dados));
    await espera("SEM_PERMISSAO", editarPessoa(db, caixa, "admin", dados));
    await espera("SEM_PERMISSAO", editarPessoa(db, ana, "ana", dados));
    await editarPessoa(db, admin, "caixa2", dados);
    await espera("NAO_ENCONTRADA", editarPessoa(db, admin, "fantasma", dados));
  });
});

describe("desativar e reativar", () => {
  it("desativa sem apagar: saldo e histórico ficam, sessões caem, transações param", async () => {
    await transferir(db, { operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 40, descricao: "x", chaveIdempotencia: "k1" });
    await db.insert(schema.session).values({ id: "s1", token: "t1", userId: "ana", expiresAt: new Date(Date.now() + 1e6) });

    await definirAtivo(db, caixa, "ana", false);
    expect(await obterPessoa(db, caixa, "ana")).toMatchObject({ ativo: false, saldo: 40 });
    expect(await db.select().from(schema.session)).toEqual([]);
    await expect(
      transferir(db, { operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 1, descricao: "x", chaveIdempotencia: "k2" }),
    ).rejects.toMatchObject({ codigo: "CONTA_DESATIVADA" });

    await definirAtivo(db, caixa, "ana", true);
    expect((await obterPessoa(db, caixa, "ana"))!.ativo).toBe(true);
    expect((await listarAuditoria(db, caixa, "ana")).map((l) => l.acao)).toEqual(["reativada", "desativada"]);
  });

  it("ninguém desativa a si mesmo, e o Caixa não desativa a equipe", async () => {
    await pessoa("caixa2", "caixa");
    await espera("PROPRIA_CONTA", definirAtivo(db, caixa, "caixa", false));
    await espera("SEM_PERMISSAO", definirAtivo(db, caixa, "caixa2", false));
    await espera("SEM_PERMISSAO", definirAtivo(db, caixa, "admin", false));
    await definirAtivo(db, admin, "caixa2", false);
  });

  it("o último Admin ativo não pode ser desativado", async () => {
    await pessoa("admin2", "admin");
    // Com dois ativos, um pode sair.
    await definirAtivo(db, { id: "admin2", papel: "admin" }, "admin", false);
    // Agora admin2 é o único ativo.
    await espera("ULTIMO_ADMIN", definirAtivo(db, admin, "admin2", false));
    expect((await obterPessoa(db, admin, "admin2"))!.ativo).toBe(true);
  });
});

describe("transações vistas pela equipe", () => {
  it("acha pelo número curto e diz quem pode estornar", async () => {
    await pessoa("caixa2", "caixa");
    const { transacao } = await transferir(db, { operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 40, descricao: "bicicleta", chaveIdempotencia: "k1" });
    const numero = transacao.id.slice(0, 8).toUpperCase();
    const [achada] = await buscarTransacoesPorNumero(db, `${numero.slice(0, 4)}-${numero.slice(4)}`);
    expect(achada).toMatchObject({ id: transacao.id, deNome: "caixa da Silva", paraNome: "ana da Silva", operadorNome: "caixa da Silva", estornadaPor: null });
    expect(await buscarTransacoesPorNumero(db, "123")).toEqual([]);
    expect(await buscarTransacoesPorNumero(db, "0000-0000")).toEqual([]);

    expect(podeEstornar(caixa, achada)).toBe(true);
    expect(podeEstornar({ id: "caixa2", papel: "caixa" }, achada)).toBe(false);
    expect(podeEstornar(admin, achada)).toBe(true);
    expect(podeEstornar(ana, achada)).toBe(false);

    const { transacao: estorno } = await estornar(db, { operadorId: "caixa", transacaoId: transacao.id, motivo: "valor errado", chaveIdempotencia: "k2" });
    const depois = (await obterTransacaoCompleta(db, transacao.id))!;
    expect(depois.estornadaPor).toBe(estorno.id);
    expect(podeEstornar(admin, depois)).toBe(false);
    expect(podeEstornar(admin, (await obterTransacaoCompleta(db, estorno.id))!)).toBe(false);
  });
});

describe("perfis (só Admin)", () => {
  it("promove e rebaixa, com registro", async () => {
    expect(await definirPapel(db, admin, "ana", "caixa")).toMatchObject({ de: "usuario", para: "caixa", email: "ana@teste.br" });
    expect((await obterPessoa(db, admin, "ana"))!.papel).toBe("caixa");
    await definirPapel(db, admin, "ana", "admin");
    await definirPapel(db, admin, "ana", "usuario");
    const log = await listarAuditoria(db, admin, "ana");
    expect(log.map((l) => l.detalhes)).toEqual([
      { de: "admin", para: "usuario" },
      { de: "caixa", para: "admin" },
      { de: "usuario", para: "caixa" },
    ]);
  });

  it("quem vira Caixa passa a ter o limite do perfil; rebaixado negativo não envia", async () => {
    await definirPapel(db, admin, "ana", "caixa");
    await transferir(db, { operadorId: "ana", contraparteId: "caixa", tipo: "dar", valor: 300, descricao: "x", chaveIdempotencia: "k1" });
    await definirPapel(db, admin, "ana", "usuario");
    expect((await obterPessoa(db, admin, "ana"))!.saldo).toBe(-300);
    await expect(
      transferir(db, { operadorId: "ana", contraparteId: "caixa", tipo: "envio", valor: 1, chaveIdempotencia: "k2" }),
    ).rejects.toMatchObject({ codigo: "SALDO_INSUFICIENTE" });
  });

  it("recusa Caixa, o próprio perfil, perfil inválido e o último Admin", async () => {
    await espera("SEM_PERMISSAO", definirPapel(db, caixa, "ana", "caixa"));
    await espera("PROPRIA_CONTA", definirPapel(db, admin, "admin", "usuario"));
    await espera("PAPEL_INVALIDO", definirPapel(db, admin, "ana", "dono" as schema.Papel));
    await espera("NAO_ENCONTRADA", definirPapel(db, admin, "fantasma", "caixa"));
    // "admin" é o único Admin: nem outro Admin (hipotético) o rebaixa.
    await espera("ULTIMO_ADMIN", definirPapel(db, { id: "outro", papel: "admin" }, "admin", "caixa"));
    await pessoa("admin2", "admin");
    await definirPapel(db, { id: "admin2", papel: "admin" }, "admin", "caixa");
  });
});

describe("limites (só Admin)", () => {
  const dar = (operadorId: string, valor: number, chaveIdempotencia: string) =>
    transferir(db, { operadorId, contraparteId: "ana", tipo: "dar", valor, descricao: "x", chaveIdempotencia });

  it("o padrão do Caixa muda para todos os Caixas sem limite próprio", async () => {
    expect(await obterLimitePadraoCaixa(db)).toBe(1000);
    await definirLimitePadraoCaixa(db, admin, 50);
    expect(await obterLimitePadraoCaixa(db)).toBe(50);
    await expect(dar("caixa", 51, "k1")).rejects.toMatchObject({ codigo: "SALDO_INSUFICIENTE" });
    await dar("caixa", 50, "k2");
    await definirLimitePadraoCaixa(db, admin, 60);
    await dar("caixa", 10, "k3");
    const [registro] = await listarAuditoriaGlobal(db, admin);
    expect(registro).toMatchObject({ acao: "limite_padrao_caixa", detalhes: { de: 50, para: 60 }, alvoId: null, atorNome: "admin da Silva" });
  });

  it("limite individual vale para Caixa e para usuário, e volta ao padrão com null", async () => {
    await definirLimite(db, admin, "caixa", 2000);
    await dar("caixa", 2000, "k1");
    await definirLimite(db, admin, "ana", 30);
    expect((await obterPessoa(db, admin, "ana"))!.limiteNegativo).toBe(30);
    await transferir(db, { operadorId: "ana", contraparteId: "caixa", tipo: "envio", valor: 2030, chaveIdempotencia: "k2" });
    await definirLimite(db, admin, "ana", null);
    await expect(
      transferir(db, { operadorId: "ana", contraparteId: "caixa", tipo: "envio", valor: 1, chaveIdempotencia: "k3" }),
    ).rejects.toMatchObject({ codigo: "SALDO_INSUFICIENTE" });
    expect((await listarAuditoria(db, admin, "ana")).map((l) => l.detalhes)).toEqual([
      { de: 30, para: null },
      { de: null, para: 30 },
    ]);
  });

  it("recusa valores inválidos, Admin como alvo e quem não é Admin", async () => {
    for (const valor of [-1, 1.5, 1_000_001, Number.NaN]) {
      await espera("LIMITE_INVALIDO", definirLimite(db, admin, "ana", valor));
      await espera("LIMITE_INVALIDO", definirLimitePadraoCaixa(db, admin, valor));
    }
    await espera("LIMITE_INVALIDO", definirLimite(db, admin, "admin", 10));
    await espera("SEM_PERMISSAO", definirLimite(db, caixa, "ana", 10));
    await espera("SEM_PERMISSAO", definirLimitePadraoCaixa(db, caixa, 10));
    await espera("SEM_PERMISSAO", listarAuditoriaGlobal(db, caixa));
    await espera("SEM_PERMISSAO", listarEquipe(db, caixa));
  });

  it("lista a equipe", async () => {
    expect((await listarEquipe(db, admin)).map((p) => p.id).sort()).toEqual(["admin", "caixa"]);
  });
});

describe("proteção da conta (segundo fator)", () => {
  async function proteger(id: string) {
    await db.insert(schema.passkey).values({ id: `pk-${id}`, userId: id, publicKey: "x", credentialID: `c-${id}`, counter: 0, deviceType: "singleDevice", backedUp: false });
    await db.insert(schema.twoFactor).values({ id: `tf-${id}`, userId: id, secret: "s", backupCodes: "b" });
    await db.update(schema.user).set({ twoFactorEnabled: true }).where(eq(schema.user.id, id));
  }

  it("o Admin remove passkeys e autenticador, com registro", async () => {
    await proteger("ana");
    await proteger("caixa");
    expect(await protecaoDaConta(db, caixa, "ana")).toEqual({ passkeys: 1, autenticador: true });

    expect(await removerSegundoFator(db, admin, "ana")).toEqual({ email: "ana@teste.br", removeu: true });
    expect(await protecaoDaConta(db, caixa, "ana")).toEqual({ passkeys: 0, autenticador: false });
    expect(await db.select().from(schema.twoFactor).where(eq(schema.twoFactor.userId, "ana"))).toEqual([]);
    // Só a conta pedida é afetada.
    expect(await protecaoDaConta(db, admin, "caixa")).toEqual({ passkeys: 1, autenticador: true });
    expect((await listarAuditoria(db, admin, "ana"))[0]).toMatchObject({
      acao: "segundo_fator_removido",
      detalhes: { passkeys: 1, autenticador: true },
    });
  });

  it("sem nada para remover não registra; e é só para Admin", async () => {
    expect(await removerSegundoFator(db, admin, "ana")).toEqual({ email: "ana@teste.br", removeu: false });
    expect(await listarAuditoria(db, admin, "ana")).toEqual([]);
    await proteger("ana");
    await espera("SEM_PERMISSAO", removerSegundoFator(db, caixa, "ana"));
    await espera("NAO_ENCONTRADA", removerSegundoFator(db, admin, "fantasma"));
    await espera("SEM_PERMISSAO", protecaoDaConta(db, ana, "ana"));
  });
});
