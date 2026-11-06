"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { pessoaLogada, VERSAO_TERMOS } from "@/lib/sessao";

export type EstadoCadastro = { erro: string; nome: string; telefone: string };

/** Só dígitos, com DDI. Aceita DDD + número (10 ou 11 dígitos) ou já com 55. */
function normalizarTelefone(bruto: string): string | null | "invalido" {
  const digitos = bruto.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return digitos;
  return "invalido";
}

export async function completarCadastro(
  _anterior: EstadoCadastro,
  dados: FormData,
): Promise<EstadoCadastro> {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect("/app/entrar");
  if (pessoa.termosAceitosEm) redirect("/app");

  const nome = String(dados.get("nome") ?? "").trim().replace(/\s+/g, " ");
  const telefoneBruto = String(dados.get("telefone") ?? "").trim();
  const falha = (erro: string) => ({ erro, nome, telefone: telefoneBruto });

  if (nome.length > 120 || nome.split(" ").filter((p) => p.length >= 2).length < 2) {
    return falha("Informe seu nome completo (nome e sobrenome).");
  }
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
