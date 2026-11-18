import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { Banco } from "../lib/db";
import * as schema from "../lib/db/schema";
import {
  buscarTransacoesPorNumero,
  estornar,
  listarExtrato,
  obterTransacaoCompleta,
  podeEstornar,
  transferir,
  verificarIntegridade,
} from "../lib/ledger";
import {
  anonimizarPessoa,
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

    await definirAtivo(db, caixa, "ana", false, "uso indevido");
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
    await espera("PROPRIA_CONTA", definirAtivo(db, caixa, "caixa", false, "teste"));
    await espera("MOTIVO_OBRIGATORIO", definirAtivo(db, caixa, "ana", false));
    await espera("SEM_PERMISSAO", definirAtivo(db, caixa, "caixa2", false, "teste"));
    await espera("SEM_PERMISSAO", definirAtivo(db, caixa, "admin", false, "teste"));
    await definirAtivo(db, admin, "caixa2", false, "teste");
  });

  it("o último Admin ativo não pode ser desativado", async () => {
    await pessoa("admin2", "admin");
    // Com dois ativos, um pode sair.
    await definirAtivo(db, { id: "admin2", papel: "admin" }, "admin", false, "teste");
    // Agora admin2 é o único ativo.
    await espera("ULTIMO_ADMIN", definirAtivo(db, admin, "admin2", false, "teste"));
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

  it("tirar o perfil de Caixa fecha o caixa: o Admin assume o saldo de caixa e o pessoal fica como estava", async () => {
    // Ana tem 50 pessoais, vira Caixa e distribui 300 no balcão.
    await transferir(db, { operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 50, descricao: "x", chaveIdempotencia: "k0" });
    await definirPapel(db, admin, "ana", "caixa");
    await definirLimite(db, admin, "ana", 500);
    await transferir(db, { operadorId: "ana", contraparteId: "caixa", tipo: "dar", valor: 300, descricao: "x", chaveIdempotencia: "k1" });
    expect(await obterPessoa(db, admin, "ana")).toMatchObject({ saldo: 50, saldoCaixa: -300, limiteNegativo: 500 });

    expect(await definirPapel(db, admin, "ana", "usuario")).toMatchObject({ de: "caixa", para: "usuario", caixaFechado: -300 });
    expect(await obterPessoa(db, admin, "ana")).toMatchObject({ papel: "usuario", saldo: 50, saldoCaixa: 0, limiteNegativo: null });
    expect((await obterPessoa(db, admin, "admin"))!.saldoCaixa).toBe(-300);
    expect((await listarAuditoria(db, admin, "ana"))[0]).toMatchObject({
      acao: "papel_alterado",
      detalhes: { de: "caixa", para: "usuario", caixaFechado: -300 },
    });
    // O histórico dela no modo Caixa continua consultável depois de sair.
    const doCaixa = await listarExtrato(db, "ana", { lado: "caixa" });
    expect(doCaixa.linhas.map((l) => [l.tipo, l.valor])).toEqual([["fechamento_caixa", 300], ["dar", -300]]);
    // De volta a usuária comum: envia os 50 dela e nada além.
    await transferir(db, { operadorId: "ana", contraparteId: "caixa", tipo: "envio", valor: 50, chaveIdempotencia: "k2" });
    await expect(
      transferir(db, { operadorId: "ana", contraparteId: "caixa", tipo: "envio", valor: 1, chaveIdempotencia: "k3" }),
    ).rejects.toMatchObject({ codigo: "SALDO_INSUFICIENTE" });
    expect((await verificarIntegridade(db)).integro).toBe(true);
  });

  it("trocar entre Caixa e Admin não fecha o caixa", async () => {
    await transferir(db, { operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 70, descricao: "x", chaveIdempotencia: "k1" });
    expect(await definirPapel(db, admin, "caixa", "admin")).toMatchObject({ caixaFechado: 0 });
    expect((await obterPessoa(db, admin, "caixa"))!.saldoCaixa).toBe(-70);
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

  it("limite individual é só do perfil Caixa, e volta ao padrão com null", async () => {
    await definirLimite(db, admin, "caixa", 2000);
    await dar("caixa", 2000, "k1");
    expect((await obterPessoa(db, admin, "caixa"))!.limiteNegativo).toBe(2000);
    await definirLimite(db, admin, "caixa", null);
    await expect(dar("caixa", 1, "k2")).rejects.toMatchObject({ codigo: "SALDO_INSUFICIENTE" });
    expect((await listarAuditoria(db, admin, "caixa")).map((l) => l.detalhes)).toEqual([
      { de: 2000, para: null },
      { de: null, para: 2000 },
    ]);
    // Usuário comum não recebe crédito.
    await espera("LIMITE_INVALIDO", definirLimite(db, admin, "ana", 30));
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

describe("encerramento de conta (anonimização)", () => {
  it("apaga os dados pessoais e as credenciais, e mantém as transações sem identificar a pessoa", async () => {
    await transferir(db, { operadorId: "caixa", contraparteId: "ana", tipo: "dar", valor: 20, descricao: "livro", chaveIdempotencia: "k1" });
    await editarPessoa(db, caixa, "ana", { nome: "Ana Maria da Silva", email: "ana@teste.br", telefone: "11912345678" });
    await db.insert(schema.session).values({ id: "s1", token: "t1", userId: "ana", expiresAt: new Date(Date.now() + 1e6) });
    await db.insert(schema.account).values({ id: "a1", accountId: "google-ana", providerId: "google", userId: "ana" });
    await db.insert(schema.passkey).values({ id: "pk", userId: "ana", publicKey: "x", credentialID: "c", counter: 0, deviceType: "singleDevice", backedUp: false });
    await db.insert(schema.verification).values({ id: "v1", identifier: "sign-in-otp-ana@teste.br", value: "x", expiresAt: new Date(Date.now() + 1e6) });
    await db.insert(schema.verification).values({ id: "v2", identifier: "sign-in-otp-caixa@teste.br", value: "x", expiresAt: new Date(Date.now() + 1e6) });

    // Com saldo, não encerra.
    await espera("SALDO_PENDENTE", anonimizarPessoa(db, admin, "ana"));
    await transferir(db, { operadorId: "caixa", contraparteId: "ana", tipo: "tomar", valor: 20, descricao: "acerto", chaveIdempotencia: "k2" });

    expect(await anonimizarPessoa(db, admin, "ana")).toEqual({ emailAntigo: "ana@teste.br" });
    const [bruta] = await db.select().from(schema.user).where(eq(schema.user.id, "ana"));
    expect(bruta).toMatchObject({ name: "Conta encerrada", telefone: null, ativo: false, emailVerified: false });
    expect(bruta.email).toMatch(/^encerrada-[0-9a-f]{18}@anonimo\.invalid$/);
    expect(await db.select().from(schema.session)).toEqual([]);
    expect(await db.select().from(schema.account)).toEqual([]);
    expect(await db.select().from(schema.passkey)).toEqual([]);
    expect((await db.select().from(schema.verification)).map((v) => v.id)).toEqual(["v2"]);

    // Nada no registro da conta guarda o nome ou o e-mail antigos.
    const registro = await listarAuditoria(db, admin, "ana");
    expect(JSON.stringify(registro)).not.toMatch(/ana@teste|Ana Maria|91234/);
    expect(registro[0].acao).toBe("conta_encerrada");
    // O livro continua fechando, e o extrato do Caixa mostra só o marcador.
    expect((await verificarIntegridade(db)).integro).toBe(true);
    const doCaixa = await listarExtrato(db, "caixa", { lado: "caixa" });
    expect(doCaixa.linhas.map((l) => l.contraparteNome)).toEqual(["Conta encerrada", "Conta encerrada"]);
    // O e-mail fica livre para um cadastro novo.
    await criarPessoa(db, caixa, { nome: "Ana Nova Conta", email: "ana@teste.br", telefone: "" });
  });

  it("é só para Admin, nunca na própria conta nem em quem ainda é da equipe", async () => {
    await espera("SEM_PERMISSAO", anonimizarPessoa(db, caixa, "ana"));
    await espera("PROPRIA_CONTA", anonimizarPessoa(db, admin, "admin"));
    await espera("SEM_PERMISSAO", anonimizarPessoa(db, admin, "caixa"));
    await espera("NAO_ENCONTRADA", anonimizarPessoa(db, admin, "fantasma"));
  });
});
