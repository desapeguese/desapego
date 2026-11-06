"use server";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { avisarMovimento } from "@/lib/avisos";
import { moeda } from "@/lib/formato";
import { ErroLedger, transferir } from "@/lib/ledger";
import { permitir } from "@/lib/limite";
import { pessoaComCadastro } from "@/lib/sessao";

const SESSAO_EXPIRADA = "Sua sessão expirou. Entre de novo.";
const SEM_CONTA = "Essa pessoa ainda não tem conta na Moeda Desapego.";

export type Destinatario = { id: string; nome: string };

/**
 * Acha quem vai receber, pelo código do QR (`para`) ou pelo e-mail. Devolve só
 * o nome: é o que a pessoa precisa para conferir antes de enviar.
 */
export async function buscarDestinatario(entrada: {
  para?: string;
  email?: string;
}): Promise<{ ok: true; destinatario: Destinatario } | { ok: false; erro: string }> {
  const pessoa = await pessoaComCadastro();
  if (!pessoa) return { ok: false, erro: SESSAO_EXPIRADA };

  // Buscar por e-mail revela quem tem conta; o limite impede varrer uma lista.
  if (!permitir(`busca:${pessoa.id}`, 30, 60 * 1000)) {
    return { ok: false, erro: "Muitas buscas. Espere um minuto e tente de novo." };
  }

  const para = String(entrada.para ?? "").trim();
  const email = String(entrada.email ?? "").trim().toLowerCase();
  if (!para && !email) return { ok: false, erro: "Informe o e-mail de quem vai receber." };
  if (para.length > 64 || email.length > 254) return { ok: false, erro: SEM_CONTA };

  const [achado] = await db
    .select({ id: schema.user.id, nome: schema.user.name })
    .from(schema.user)
    .where(
      and(
        para ? eq(schema.user.id, para) : eq(schema.user.email, email),
        eq(schema.user.ativo, true),
      ),
    );
  if (!achado) return { ok: false, erro: SEM_CONTA };
  if (achado.id === pessoa.id) return { ok: false, erro: "Essa é a sua própria conta." };
  // Quem foi cadastrado pelo Caixa e ainda não entrou pode estar sem nome.
  return { ok: true, destinatario: { id: achado.id, nome: achado.nome || "Sem nome" } };
}

export async function enviar(dados: {
  paraId: string;
  valor: number;
  descricao: string;
  chave: string;
}): Promise<{ ok: true; transacaoId: string } | { ok: false; erro: string }> {
  const pessoa = await pessoaComCadastro();
  if (!pessoa) return { ok: false, erro: SESSAO_EXPIRADA };

  const descricao = String(dados.descricao ?? "").trim();
  if (descricao.length > 140) return { ok: false, erro: "A descrição tem no máximo 140 letras." };
  const chave = String(dados.chave ?? "");
  if (chave.length < 16 || chave.length > 64) return { ok: false, erro: "Pedido inválido." };

  try {
    const { transacao, repetida } = await transferir(db, {
      operadorId: pessoa.id,
      contraparteId: String(dados.paraId ?? ""),
      tipo: "envio",
      valor: Number(dados.valor),
      descricao,
      // Prefixada com o id de quem envia: a chave de uma pessoa nunca colide
      // com a de outra.
      chaveIdempotencia: `${pessoa.id}:${chave}`,
    });
    if (!repetida) avisarMovimento(transacao, { id: pessoa.id, nome: pessoa.name });
    return { ok: true, transacaoId: transacao.id };
  } catch (erro) {
    if (!(erro instanceof ErroLedger)) throw erro;
    if (erro.codigo === "SALDO_INSUFICIENTE") {
      return {
        ok: false,
        erro: `Saldo insuficiente: você pode enviar até ${moeda(erro.dados.disponivel)}.`,
      };
    }
    return { ok: false, erro: erro.message };
  }
}
