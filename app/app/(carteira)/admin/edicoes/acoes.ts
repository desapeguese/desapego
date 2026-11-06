"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { criarEdicao, editarEdicao, removerEdicao } from "@/lib/edicoes";
import { ErroPessoa } from "@/lib/pessoas";
import { pessoaComCadastro } from "@/lib/sessao";

async function admin() {
  const pessoa = await pessoaComCadastro();
  return pessoa?.papel === "admin" ? pessoa : null;
}

const ler = (dados: FormData) => ({
  nome: String(dados.get("nome") ?? ""),
  inicio: String(dados.get("inicio") ?? ""),
  fim: String(dados.get("fim") ?? ""),
});

async function executar(aviso: string, acao: (ator: NonNullable<Awaited<ReturnType<typeof admin>>>) => Promise<unknown>) {
  const ator = await admin();
  if (!ator) redirect("/app");
  let resultado = aviso;
  try {
    await acao(ator);
  } catch (erro) {
    if (!(erro instanceof ErroPessoa)) throw erro;
    resultado = `erro:${erro.message}`;
  }
  redirect(`/app/admin/edicoes?aviso=${encodeURIComponent(resultado)}`);
}

export async function criar(dados: FormData): Promise<void> {
  await executar("criada", (ator) => criarEdicao(db, ator, ler(dados)));
}

export async function salvar(dados: FormData): Promise<void> {
  await executar("alterada", (ator) => editarEdicao(db, ator, String(dados.get("id") ?? ""), ler(dados)));
}

export async function remover(dados: FormData): Promise<void> {
  await executar("removida", (ator) => removerEdicao(db, ator, String(dados.get("id") ?? "")));
}
