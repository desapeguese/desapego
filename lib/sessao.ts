import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, ehAdminInicial, exigirSegredo, tem2FA } from "./auth";
import { db, schema } from "./db";
import type { Papel } from "./db/schema";

/** Data do texto em vigor (app/termos/page.tsx, docs/termos-de-uso.md). */
export const VERSAO_TERMOS = "2026-11-07";

export type Pessoa = typeof schema.user.$inferSelect;

export type SessaoAtual = {
  pessoa: Pessoa;
  /** Quem tem 2FA: passkey ou app autenticador. */
  tem2FA: boolean;
  /** Tem 2FA e esta sessão ainda não o provou (entrou só com e-mail ou Google). */
  segundoFatorPendente: boolean;
};

/**
 * A sessão deste pedido, lida do banco a cada vez (papel e `ativo` nunca vêm
 * de cache). `null` sem sessão ou com conta desativada.
 */
export async function sessaoAtual(): Promise<SessaoAtual | null> {
  // `headers()` vem primeiro: é ele que diz ao Next que a página depende do
  // pedido. Com a checagem do segredo antes, o build (que roda sem variáveis)
  // tentaria pré-renderizar a página e quebraria.
  const cabecalhos = await headers();
  exigirSegredo();
  const sessao = await auth.api.getSession({ headers: cabecalhos });
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

  const protegida = await tem2FA(pessoa.id, pessoa.twoFactorEnabled);
  const provou = (sessao.session as { segundoFator?: boolean | null }).segundoFator === true;
  return { pessoa, tem2FA: protegida, segundoFatorPendente: protegida && !provou };
}

/**
 * A pessoa logada de verdade: com sessão e, se tiver 2FA, com o segundo fator
 * provado. Uma sessão pendente vale como "não logada" para tudo, exceto a
 * tela /app/verificar.
 */
export async function pessoaLogada(): Promise<Pessoa | null> {
  const sessao = await sessaoAtual();
  return sessao && !sessao.segundoFatorPendente ? sessao.pessoa : null;
}

/**
 * Porta de entrada de toda página do app: sem sessão vai para o login, sem
 * aceite dos termos vai completar o cadastro.
 */
export async function exigirPessoa(opcoes: { papeis?: Papel[] } = {}): Promise<Pessoa> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/app/entrar");
  if (sessao.segundoFatorPendente) redirect("/app/verificar");
  const { pessoa } = sessao;
  if (!pessoa.termosAceitosEm) redirect("/app/cadastro");
  if (opcoes.papeis && !opcoes.papeis.includes(pessoa.papel)) redirect("/app");
  return pessoa;
}

/**
 * Para server actions, que devolvem erro em vez de redirecionar: a pessoa
 * logada e com cadastro completo, ou `null`.
 */
export async function pessoaComCadastro(): Promise<Pessoa | null> {
  const pessoa = await pessoaLogada();
  return pessoa?.termosAceitosEm ? pessoa : null;
}
