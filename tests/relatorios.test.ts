import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { Banco } from "../lib/db";
import * as schema from "../lib/db/schema";
import { estornar, transferir } from "../lib/ledger";
import { criarEdicao, edicaoDoDia, editarEdicao, listarEdicoes, obterEdicao, removerEdicao } from "../lib/edicoes";
import { celulaCsv, graoSugerido, limparFiltros, linhaCsv, listarTransacoes, resumirPeriodo, retratoAtual, seriePorPeriodo } from "../lib/relatorios";

let db: Banco;
let n = 0;

async function pessoa(id: string, papel: schema.Papel = "usuario", ativo = true) {
  await db.insert(schema.user).values({ id, name: `${id} da Silva`, email: `${id}@teste.br`, papel, ativo });
}
const mover = (operadorId: string, contraparteId: string, tipo: "envio" | "dar" | "tomar" | "deposito_cedula" | "saque_cedula", valor: number) =>
  transferir(db, { operadorId, contraparteId, tipo, valor, descricao: "x", chaveIdempotencia: `k${++n}`, confirmarNegativo: true });

beforeEach(async () => {
  const banco = drizzle(new PGlite(), { schema });
  await migrate(banco, { migrationsFolder: "./drizzle" });
  db = banco;
  await pessoa("ana");
  await pessoa("bia");
  await pessoa("inativa", "usuario", false);
  await pessoa("caixa", "caixa");
  await pessoa("admin", "admin");

  await mover("caixa", "ana", "dar", 100);
  await mover("admin", "bia", "dar", 40);
  await mover("ana", "bia", "envio", 30);
  await mover("caixa", "bia", "tomar", 20);
  await mover("caixa", "ana", "deposito_cedula", 7);
  await mover("caixa", "ana", "saque_cedula", 2);
});

describe("resumo do período", () => {
  it("soma volume, transações, pessoas e cédulas", async () => {
    const r = await resumirPeriodo(db, {});
    expect(r).toMatchObject({ transacoes: 6, volume: 199, pessoasAtivas: 4, depositadoEmCedulas: 7, sacadoEmCedulas: 2 });
    expect(Object.fromEntries(r.porTipo.map((l) => [l.tipo, [l.transacoes, l.volume]]))).toEqual({
      dar: [2, 140],
      envio: [1, 30],
      tomar: [1, 20],
      deposito_cedula: [1, 7],
      saque_cedula: [1, 2],
    });
  });

  it("filtra por tipo, operador e usuário", async () => {
    expect(await resumirPeriodo(db, { tipo: "dar" })).toMatchObject({ transacoes: 2, volume: 140 });
    expect(await resumirPeriodo(db, { operadorId: "caixa" })).toMatchObject({ transacoes: 4, volume: 129 });
    expect(await resumirPeriodo(db, { usuarioId: "bia" })).toMatchObject({ transacoes: 3, volume: 90 });
    expect(await resumirPeriodo(db, { usuarioId: "bia", tipo: "envio" })).toMatchObject({ transacoes: 1, volume: 30, pessoasAtivas: 2 });
    expect(await resumirPeriodo(db, { usuarioId: "ninguem" })).toMatchObject({ transacoes: 0, volume: 0, pessoasAtivas: 0, porTipo: [] });
  });

  it("filtra por dia no horário de Brasília, com as duas pontas inclusivas", async () => {
    const [{ hoje, ontem, amanha }] = (
      await db.execute(sql`
        select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as hoje,
               to_char((now() at time zone 'America/Sao_Paulo') - interval '1 day', 'YYYY-MM-DD') as ontem,
               to_char((now() at time zone 'America/Sao_Paulo') + interval '1 day', 'YYYY-MM-DD') as amanha
      `)
    ).rows as { hoje: string; ontem: string; amanha: string }[];
    expect((await resumirPeriodo(db, { de: hoje, ate: hoje })).transacoes).toBe(6);
    expect((await resumirPeriodo(db, { ate: ontem })).transacoes).toBe(0);
    expect((await resumirPeriodo(db, { de: amanha })).transacoes).toBe(0);
    expect((await resumirPeriodo(db, { de: ontem, ate: amanha })).transacoes).toBe(6);
  });
});

describe("retrato atual", () => {
  it("mostra circulação, emissão da organização, destaques e integridade", async () => {
    // ana: +100 −30 +7 −2 = 75; bia: +40 +30 −20 = 50; caixa: −100 +20 −7 +2 = −85; admin: −40
    const r = await retratoAtual(db);
    expect(r).toMatchObject({ pessoas: 5, pessoasAtivas: 4, somaPositivos: 125, somaNegativos: -125, negativoDaOrganizacao: -125 });
    expect(r.maioresPositivos.map((p) => [p.id, p.saldo])).toEqual([["ana", 75], ["bia", 50]]);
    expect(r.maioresNegativos.map((p) => [p.id, p.saldo])).toEqual([["caixa", -85], ["admin", -40]]);
    expect(r.integridade.integro).toBe(true);
  });

  it("usuário negativo conta nos negativos, mas não na emissão da organização", async () => {
    await mover("caixa", "bia", "tomar", 60);
    const r = await retratoAtual(db);
    expect(r.somaNegativos).toBe(-75);
    expect(r.negativoDaOrganizacao).toBe(-65);
    expect(r.maioresNegativos.map((p) => p.id)).toEqual(["admin", "caixa", "bia"]);
  });
});

describe("lista de transações", () => {
  it("traz nomes, e-mails e operador, e pagina sem pular", async () => {
    const vistos: number[] = [];
    let cursor: string | null = null;
    do {
      const pagina = await listarTransacoes(db, {}, { limite: 4, cursor });
      vistos.push(...pagina.linhas.map((l) => l.valor));
      cursor = pagina.proximo;
    } while (cursor);
    expect(vistos).toEqual([2, 7, 20, 30, 40, 100]);

    const { linhas } = await listarTransacoes(db, { tipo: "tomar" });
    expect(linhas).toMatchObject([
      { tipo: "tomar", valor: 20, deNome: "bia da Silva", deEmail: "bia@teste.br", paraNome: "caixa da Silva", operadorEmail: "caixa@teste.br" },
    ]);
    expect(await listarTransacoes(db, {}, { cursor: "lixo" })).toEqual({ linhas: [], proximo: null });
  });

  it("inclui estornos com a referência à original", async () => {
    const { linhas: antes } = await listarTransacoes(db, { tipo: "envio" });
    await estornar(db, { operadorId: "admin", transacaoId: antes[0].id, motivo: "erro", chaveIdempotencia: "e1" });
    const { linhas } = await listarTransacoes(db, { tipo: "estorno" });
    expect(linhas).toMatchObject([{ estornoDe: antes[0].id, valor: 30, deId: "bia", paraId: "ana", operadorNome: "admin da Silva" }]);
  });
});

describe("filtros vindos da URL", () => {
  it("mantém só o que é válido", () => {
    expect(limparFiltros({ de: "2026-11-01", ate: "2026-11-30", tipo: "dar", operadorId: "x", usuarioId: "y" })).toEqual({
      de: "2026-11-01", ate: "2026-11-30", tipo: "dar", operadorId: "x", usuarioId: "y",
    });
    expect(limparFiltros({ de: "ontem", ate: "2026-13-45", tipo: "roubo'; drop table", operadorId: "" })).toEqual({});
  });
});

describe("CSV", () => {
  it("escapa aspas, separador e quebras de linha", () => {
    expect(celulaCsv("simples")).toBe("simples");
    expect(celulaCsv('diz "oi"; e sai')).toBe('"diz ""oi""; e sai"');
    expect(celulaCsv("duas\nlinhas")).toBe('"duas\nlinhas"');
    expect(celulaCsv(42)).toBe("42");
    expect(celulaCsv(null)).toBe("");
  });

  it("neutraliza fórmulas de planilha", () => {
    expect(celulaCsv("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(celulaCsv("+55 11")).toBe("'+55 11");
    expect(celulaCsv("-desconto")).toBe("'-desconto");
    expect(celulaCsv("@fulano")).toBe("'@fulano");
    expect(linhaCsv(["a", 1, null, "=1+1"])).toBe("a;1;;'=1+1\r\n");
  });
});

describe("série por período", () => {
  it("separa emissão, recolhimento e trocas entre pessoas", async () => {
    const serie = await seriePorPeriodo(db, {}, "dia");
    // dar 100 + dar 40 + depósito 7 | tomar 20 + saque 2 | envio 30
    expect(serie).toHaveLength(1);
    expect(serie[0]).toMatchObject({ emitido: 147, recolhido: 22, entrePessoas: 30 });
    expect(serie[0].inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("um estorno conta no sentido contrário ao da transação desfeita", async () => {
    const { linhas: dadas } = await listarTransacoes(db, { tipo: "dar" });
    const { linhas: tomadas } = await listarTransacoes(db, { tipo: "tomar" });
    const { linhas: envios } = await listarTransacoes(db, { tipo: "envio" });
    await estornar(db, { operadorId: "admin", transacaoId: dadas[0].id, motivo: "x", chaveIdempotencia: "e1" });
    await estornar(db, { operadorId: "admin", transacaoId: tomadas[0].id, motivo: "x", chaveIdempotencia: "e2" });
    await estornar(db, { operadorId: "admin", transacaoId: envios[0].id, motivo: "x", chaveIdempotencia: "e3" });
    const [ponto] = await seriePorPeriodo(db, {}, "mes");
    expect(ponto).toMatchObject({ emitido: 147 + 20, recolhido: 22 + dadas[0].valor, entrePessoas: 60 });
    expect(ponto.inicio.endsWith("-01")).toBe(true);
  });

  it("respeita os filtros, agrupa por semana e devolve vazio sem dados", async () => {
    expect(await seriePorPeriodo(db, { usuarioId: "ninguem" }, "dia")).toEqual([]);
    const [semana] = await seriePorPeriodo(db, { operadorId: "admin" }, "semana");
    expect(semana).toMatchObject({ emitido: 40, recolhido: 0, entrePessoas: 0 });
    expect(new Date(`${semana.inicio}T12:00:00Z`).getUTCDay()).toBe(1);
  });

  it("sugere o grão pelo tamanho do intervalo", () => {
    expect(graoSugerido("2026-11-01", "2026-11-30")).toBe("dia");
    expect(graoSugerido("2026-01-01", "2026-06-30")).toBe("semana");
    expect(graoSugerido("2024-01-01", "2026-12-31")).toBe("mes");
  });
});

describe("edições do festival", () => {
  const admin = { id: "admin", papel: "admin" as const };
  const caixa = { id: "caixa", papel: "caixa" as const };

  it("cria, edita e remove com registro, e acha a edição de um dia", async () => {
    const e = await criarEdicao(db, admin, { nome: "  Festival  2026 ", inicio: "2026-11-27", fim: "2026-11-29" });
    expect(e).toMatchObject({ nome: "Festival 2026", inicio: "2026-11-27", fim: "2026-11-29" });
    expect((await edicaoDoDia(db, "2026-11-27"))?.id).toBe(e.id);
    expect((await edicaoDoDia(db, "2026-11-29"))?.id).toBe(e.id);
    expect(await edicaoDoDia(db, "2026-11-30")).toBeNull();

    await editarEdicao(db, admin, e.id, { nome: "Festival 2026", inicio: "2026-11-27", fim: "2026-11-30" });
    expect((await edicaoDoDia(db, "2026-11-30"))?.id).toBe(e.id);
    await editarEdicao(db, admin, e.id, { nome: "Festival 2026", inicio: "2026-11-27", fim: "2026-11-30" });
    await removerEdicao(db, admin, e.id);
    expect(await listarEdicoes(db)).toEqual([]);
    expect(await obterEdicao(db, e.id)).toBeNull();

    const acoes = (await db.select().from(schema.auditoria)).map((a) => a.acao).sort();
    expect(acoes).toEqual(["edicao_alterada", "edicao_criada", "edicao_removida"]);
  });

  it("recusa datas invertidas, nome vazio e quem não é Admin", async () => {
    await expect(criarEdicao(db, admin, { nome: "X 2026", inicio: "2026-12-02", fim: "2026-12-01" })).rejects.toMatchObject({ codigo: "LIMITE_INVALIDO" });
    await expect(criarEdicao(db, admin, { nome: " ", inicio: "2026-12-01", fim: "2026-12-01" })).rejects.toMatchObject({ codigo: "NOME_INVALIDO" });
    await expect(criarEdicao(db, admin, { nome: "X 2026", inicio: "amanhã", fim: "2026-12-01" })).rejects.toMatchObject({ codigo: "LIMITE_INVALIDO" });
    await expect(criarEdicao(db, caixa, { nome: "X 2026", inicio: "2026-12-01", fim: "2026-12-01" })).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(removerEdicao(db, admin, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ codigo: "NAO_ENCONTRADA" });
  });
});
