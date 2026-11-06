import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, ehAdminInicial, exigirSegredo } from "./auth";
import { db, schema } from "./db";
import type { Papel } from "./db/schema";

export const VERSAO_TERMOS = "2026-11-rascunho";

export type Pessoa = typeof schema.user.$inferSelect;

/**
 * A pessoa logada, lida do banco a cada pedido (papel e `ativo` nunca vêm de
 * cache). Devolve `null` sem sessão ou com conta desativada.
 */
export async function pessoaLogada(): Promise<Pessoa | null> {
  exigirSegredo();
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao) return null;

  const [pessoa] = await db.select().from(schema.user).where(eq(schema.user.id, sessao.user.id));
  if (!pessoa || !pessoa.ativo) return null;

  // Quem entrou na lista ADMIN_EMAILS depois de já ter conta é promovido no
  // acesso seguinte. Só com e-mail verificado, que é o que prova a posse.
  if (pessoa.papel !== "admin" && pessoa.emailVerified && ehAdminInicial(pessoa.email)) {
    await db.transaction(async (tx) => {
      await tx.update(schema.user).set({ papel: "admin" }).where(eq(schema.user.id, pessoa.id));
      await tx.insert(schema.auditoria).values({
        alvoId: pessoa.id,
        acao: "papel_alterado",
        detalhes: { de: pessoa.papel, para: "admin", origem: "ADMIN_EMAILS" },
      });
    });
    pessoa.papel = "admin";
  }
  return pessoa;
}

/**
 * Porta de entrada de toda página do app: sem sessão vai para o login, sem
 * aceite dos termos vai completar o cadastro.
 */
export async function exigirPessoa(opcoes: { papeis?: Papel[] } = {}): Promise<Pessoa> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect("/app/entrar");
  if (!pessoa.termosAceitosEm) redirect("/app/cadastro");
  if (opcoes.papeis && !opcoes.papeis.includes(pessoa.papel)) redirect("/app");
  return pessoa;
}
