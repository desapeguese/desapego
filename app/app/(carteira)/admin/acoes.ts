"use server";

import { redirect } from "next/navigation";
import { avisarPerfilAlterado, avisarSegundoFatorRemovido } from "@/lib/avisos";
import { ehAdminInicial } from "@/lib/cadastro";
import { db } from "@/lib/db";
import type { Papel } from "@/lib/db/schema";
import {
  definirLimite,
  definirLimitePadraoCaixa,
  definirPapel,
  ErroPessoa,
  obterPessoa,
  removerSegundoFator,
} from "@/lib/pessoas";
import { pessoaComCadastro } from "@/lib/sessao";

/** Quem está logado, se for Admin. O papel vem do banco a cada pedido. */
async function admin() {
  const pessoa = await pessoaComCadastro();
  return pessoa?.papel === "admin" ? pessoa : null;
}

const ficha = (id: string, aviso: string) => `/app/caixa/pessoa/${id}?aviso=${encodeURIComponent(aviso)}`;

export async function mudarPapel(dados: FormData): Promise<void> {
  const alvoId = String(dados.get("id") ?? "");
  const papel = String(dados.get("papel") ?? "") as Papel;
  const ator = await admin();
  if (!ator) redirect("/app");

  let aviso = "papel";
  try {
    // Quem está em ADMIN_EMAILS volta a ser Admin no acesso seguinte (ver
    // lib/sessao.ts); rebaixar por aqui só criaria uma mudança que não dura.
    const alvo = await obterPessoa(db, ator, alvoId);
    if (alvo && papel !== "admin" && ehAdminInicial(alvo.email)) {
      redirect(ficha(alvoId, "erro:ADMIN_INICIAL"));
    }
    const { de, para, email } = await definirPapel(db, ator, alvoId, papel);
    if (de !== para) avisarPerfilAlterado(email, de, para, ator.name);
  } catch (erro) {
    if (!(erro instanceof ErroPessoa)) throw erro;
    aviso = `erro:${erro.codigo}`;
  }
  redirect(ficha(alvoId, aviso));
}

export async function mudarLimite(dados: FormData): Promise<void> {
  const alvoId = String(dados.get("id") ?? "");
  const bruto = String(dados.get("limite") ?? "").trim();
  const ator = await admin();
  if (!ator) redirect("/app");

  let aviso = "limite";
  try {
    // Em branco = voltar ao padrão do perfil.
    await definirLimite(db, ator, alvoId, bruto === "" ? null : /^\d+$/.test(bruto) ? Number(bruto) : Number.NaN);
  } catch (erro) {
    if (!(erro instanceof ErroPessoa)) throw erro;
    aviso = `erro:${erro.codigo}`;
  }
  redirect(ficha(alvoId, aviso));
}

export async function mudarLimitePadrao(dados: FormData): Promise<void> {
  const bruto = String(dados.get("limite") ?? "").trim();
  const ator = await admin();
  if (!ator) redirect("/app");

  let aviso = "limite";
  try {
    await definirLimitePadraoCaixa(db, ator, /^\d+$/.test(bruto) ? Number(bruto) : Number.NaN);
  } catch (erro) {
    if (!(erro instanceof ErroPessoa)) throw erro;
    aviso = "erro";
  }
  redirect(`/app/admin?aviso=${aviso}`);
}

export async function resetarSegundoFator(dados: FormData): Promise<void> {
  const alvoId = String(dados.get("id") ?? "");
  const ator = await admin();
  if (!ator) redirect("/app");

  let aviso = "fator";
  try {
    const { email, removeu } = await removerSegundoFator(db, ator, alvoId);
    if (removeu) avisarSegundoFatorRemovido(email, ator.name);
  } catch (erro) {
    if (!(erro instanceof ErroPessoa)) throw erro;
    aviso = `erro:${erro.codigo}`;
  }
  redirect(ficha(alvoId, aviso));
}
