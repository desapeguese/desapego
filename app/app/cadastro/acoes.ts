"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { normalizarNome, normalizarTelefone } from "@/lib/pessoas";
import { pessoaLogada, VERSAO_TERMOS } from "@/lib/sessao";

export type EstadoCadastro = { erro: string; nome: string; telefone: string };

export async function completarCadastro(
  _anterior: EstadoCadastro,
  dados: FormData,
): Promise<EstadoCadastro> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect("/app/entrar");
  if (pessoa.termosAceitosEm) redirect("/app");

  const nomeBruto = String(dados.get("nome") ?? "");
  const telefoneBruto = String(dados.get("telefone") ?? "").trim();
  const falha = (erro: string) => ({ erro, nome: nomeBruto, telefone: telefoneBruto });

  const nome = normalizarNome(nomeBruto);
  if (!nome) return falha("Informe seu nome completo (nome e sobrenome).");
  const telefone = normalizarTelefone(telefoneBruto);
  if (telefone === "invalido") {
    return falha("Telefone inválido. Use DDD + número, ou deixe em branco.");
  }
  if (dados.get("maior") !== "on") {
    return falha("A Moeda Desapego é só para maiores de 18 anos.");
  }
  if (dados.get("termos") !== "on") {
    return falha("É preciso aceitar os termos de uso e a política de privacidade.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.user)
      .set({
        name: nome,
        telefone,
        termosAceitosEm: new Date(),
        termosVersao: VERSAO_TERMOS,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, pessoa.id));
    await tx.insert(schema.auditoria).values({
      atorId: pessoa.id,
      alvoId: pessoa.id,
      acao: "termos_aceitos",
      detalhes: { versao: VERSAO_TERMOS, maiorDeIdade: true },
    });
  });
  redirect("/app");
}
