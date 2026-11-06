import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Banco } from "./db";
import { auditoria, edicao } from "./db/schema";
import { ErroPessoa, type Ator } from "./pessoas";

/** Edições do Festival: cadastro pelo Admin, com registro de cada mudança. */

export type Edicao = typeof edicao.$inferSelect;

const ehData = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function validar(dados: { nome: string; inicio: string; fim: string }) {
  const nome = dados.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 80) {
    throw new ErroPessoa("NOME_INVALIDO", "Dê um nome à edição (de 2 a 80 letras).");
  }
  if (!ehData(dados.inicio) || !ehData(dados.fim)) {
    throw new ErroPessoa("LIMITE_INVALIDO", "Informe as datas de início e de fim.");
  }
  if (dados.inicio > dados.fim) {
    throw new ErroPessoa("LIMITE_INVALIDO", "A data de início não pode ser depois da data de fim.");
  }
  return { nome, inicio: dados.inicio, fim: dados.fim };
}

function exigirAdmin(ator: Ator) {
  if (ator.papel !== "admin") throw new ErroPessoa("SEM_PERMISSAO", "Restrito a Admin.");
}

/** Da mais recente para a mais antiga. */
export const listarEdicoes = (db: Banco) => db.select().from(edicao).orderBy(desc(edicao.inicio), desc(edicao.criadaEm));

export async function obterEdicao(db: Banco, id: string): Promise<Edicao | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [achada] = await db.select().from(edicao).where(eq(edicao.id, id));
  return achada ?? null;
}

/** A edição que contém o dia ("AAAA-MM-DD", horário de Brasília), se houver. */
export async function edicaoDoDia(db: Banco, dia: string): Promise<Edicao | null> {
  const [achada] = await db
    .select()
    .from(edicao)
    .where(and(lte(edicao.inicio, dia), gte(edicao.fim, dia)))
    .orderBy(desc(edicao.inicio))
    .limit(1);
  return achada ?? null;
}

export async function criarEdicao(db: Banco, ator: Ator, dados: { nome: string; inicio: string; fim: string }) {
  exigirAdmin(ator);
  const valores = validar(dados);
  return db.transaction(async (tx) => {
    const [criada] = await tx.insert(edicao).values(valores).returning();
    await tx.insert(auditoria).values({ atorId: ator.id, acao: "edicao_criada", detalhes: valores });
    return criada;
  });
}

export async function editarEdicao(
  db: Banco,
  ator: Ator,
  id: string,
  dados: { nome: string; inicio: string; fim: string },
) {
  exigirAdmin(ator);
  const valores = validar(dados);
  await db.transaction(async (tx) => {
    const [atual] = await tx.select().from(edicao).where(eq(edicao.id, id)).for("update");
    if (!atual) throw new ErroPessoa("NAO_ENCONTRADA", "Edição não encontrada.");
    if (atual.nome === valores.nome && atual.inicio === valores.inicio && atual.fim === valores.fim) return;
    await tx.update(edicao).set(valores).where(eq(edicao.id, id));
    await tx.insert(auditoria).values({
      atorId: ator.id,
      acao: "edicao_alterada",
      detalhes: { de: { nome: atual.nome, inicio: atual.inicio, fim: atual.fim }, para: valores },
    });
  });
}

/** Remover uma edição não apaga transações: elas só deixam de pertencer a ela. */
export async function removerEdicao(db: Banco, ator: Ator, id: string) {
  exigirAdmin(ator);
  await db.transaction(async (tx) => {
    const [removida] = await tx.delete(edicao).where(eq(edicao.id, id)).returning();
    if (!removida) throw new ErroPessoa("NAO_ENCONTRADA", "Edição não encontrada.");
    await tx.insert(auditoria).values({
      atorId: ator.id,
      acao: "edicao_removida",
      detalhes: { nome: removida.nome, inicio: removida.inicio, fim: removida.fim },
    });
  });
}
