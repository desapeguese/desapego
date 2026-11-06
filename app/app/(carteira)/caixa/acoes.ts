"use server";

import { redirect } from "next/navigation";
import { avisarDadosAlterados, avisarMovimento } from "@/lib/avisos";
import { db } from "@/lib/db";
import { moeda } from "@/lib/formato";
import { ErroLedger, estornar, transferir } from "@/lib/ledger";
import { criarPessoa, definirAtivo, editarPessoa, ErroPessoa } from "@/lib/pessoas";
import { pessoaComCadastro } from "@/lib/sessao";

const SEM_ACESSO = "Sua sessão expirou ou você não é mais do Caixa. Entre de novo.";

/** Quem está logado, se for Caixa ou Admin. O papel vem do banco a cada pedido. */
async function equipe() {
  const pessoa = await pessoaComCadastro();
  return pessoa && pessoa.papel !== "usuario" ? pessoa : null;
}

export type EstadoPessoa = {
  erro: string;
  /** Em e-mail repetido, a conta que já existe. */
  existenteId?: string;
  nome: string;
  email: string;
  telefone: string;
};

function lerPessoa(dados: FormData) {
  return {
    nome: String(dados.get("nome") ?? ""),
    email: String(dados.get("email") ?? ""),
    telefone: String(dados.get("telefone") ?? ""),
  };
}

export async function cadastrar(_anterior: EstadoPessoa, dados: FormData): Promise<EstadoPessoa> {
  const campos = lerPessoa(dados);
  const ator = await equipe();
  if (!ator) return { ...campos, erro: SEM_ACESSO };

  let id: string;
  try {
    ({ id } = await criarPessoa(db, ator, campos));
  } catch (erro) {
    if (!(erro instanceof ErroPessoa)) throw erro;
    return { ...campos, erro: erro.message, existenteId: erro.pessoaId };
  }
  redirect(`/app/caixa/pessoa/${id}?aviso=cadastrada`);
}

export async function editar(_anterior: EstadoPessoa, dados: FormData): Promise<EstadoPessoa> {
  const campos = lerPessoa(dados);
  const alvoId = String(dados.get("id") ?? "");
  const ator = await equipe();
  if (!ator) return { ...campos, erro: SEM_ACESSO };

  try {
    const { alteracoes, emailAntigo } = await editarPessoa(db, ator, alvoId, campos);
    // Contato trocado por outra pessoa: avisa o endereço antigo, que é quem
    // perde o acesso se a troca não foi pedida.
    const contato = [alteracoes.email && "o e-mail", alteracoes.telefone && "o telefone"].filter(
      (c): c is string => Boolean(c),
    );
    if (contato.length > 0 && ator.id !== alvoId) avisarDadosAlterados(emailAntigo, contato, ator.name);
  } catch (erro) {
    if (!(erro instanceof ErroPessoa)) throw erro;
    return { ...campos, erro: erro.message, existenteId: erro.pessoaId };
  }
  redirect(`/app/caixa/pessoa/${alvoId}?aviso=alterada`);
}

export async function alternarAtivo(dados: FormData): Promise<void> {
  const alvoId = String(dados.get("id") ?? "");
  const ativar = dados.get("ativar") === "1";
  const ator = await equipe();
  if (!ator) redirect("/app");

  let aviso = ativar ? "reativada" : "desativada";
  try {
    await definirAtivo(db, ator, alvoId, ativar);
  } catch (erro) {
    if (!(erro instanceof ErroPessoa)) throw erro;
    aviso = `erro:${erro.codigo}`;
  }
  redirect(`/app/caixa/pessoa/${alvoId}?aviso=${encodeURIComponent(aviso)}`);
}

export type TipoOperacao = "dar" | "tomar" | "deposito_cedula" | "saque_cedula";
const TIPOS: TipoOperacao[] = ["dar", "tomar", "deposito_cedula", "saque_cedula"];

export async function operar(dados: {
  alvoId: string;
  tipo: TipoOperacao;
  valor: number;
  descricao: string;
  chave: string;
  confirmarNegativo: boolean;
}): Promise<
  | { ok: true; transacaoId: string }
  | { ok: false; erro: string; saldoResultante?: number }
> {
  const ator = await equipe();
  if (!ator) return { ok: false, erro: SEM_ACESSO };
  if (!TIPOS.includes(dados.tipo)) return { ok: false, erro: "Operação inválida." };

  const descricao = String(dados.descricao ?? "").trim();
  if (descricao.length > 140) return { ok: false, erro: "A descrição tem no máximo 140 letras." };
  const chave = String(dados.chave ?? "");
  if (chave.length < 16 || chave.length > 64) return { ok: false, erro: "Pedido inválido." };

  try {
    const { transacao, repetida } = await transferir(db, {
      operadorId: ator.id,
      contraparteId: String(dados.alvoId ?? ""),
      tipo: dados.tipo,
      valor: Number(dados.valor),
      descricao,
      chaveIdempotencia: `${ator.id}:${chave}`,
      confirmarNegativo: dados.confirmarNegativo === true,
    });
    if (!repetida) avisarMovimento(transacao, { id: ator.id, nome: ator.name });
    return { ok: true, transacaoId: transacao.id };
  } catch (erro) {
    if (!(erro instanceof ErroLedger)) throw erro;
    if (erro.codigo === "SALDO_INSUFICIENTE") {
      return {
        ok: false,
        erro: `Seu limite de Caixa não cobre esse valor: você ainda pode distribuir ${moeda(erro.dados.disponivel)}.`,
      };
    }
    if (erro.codigo === "CONFIRMACAO_NECESSARIA") {
      return { ok: false, erro: "", saldoResultante: erro.dados.saldoResultante };
    }
    return { ok: false, erro: erro.message };
  }
}

export type EstadoEstorno = { erro: string; motivo: string };

export async function estornarTransacao(_anterior: EstadoEstorno, dados: FormData): Promise<EstadoEstorno> {
  const motivo = String(dados.get("motivo") ?? "");
  const transacaoId = String(dados.get("id") ?? "");
  const chave = String(dados.get("chave") ?? "");
  const ator = await equipe();
  if (!ator) return { erro: SEM_ACESSO, motivo };
  if (motivo.trim().length > 140) return { erro: "O motivo tem no máximo 140 letras.", motivo };
  if (chave.length < 16 || chave.length > 64) return { erro: "Pedido inválido.", motivo };

  let estornoId: string;
  try {
    const { transacao, repetida } = await estornar(db, {
      operadorId: ator.id,
      transacaoId,
      motivo,
      chaveIdempotencia: `${ator.id}:${chave}`,
    });
    if (!repetida) avisarMovimento(transacao, { id: ator.id, nome: ator.name });
    estornoId = transacao.id;
  } catch (erro) {
    if (!(erro instanceof ErroLedger)) throw erro;
    return { erro: erro.message, motivo };
  }
  redirect(`/app/caixa/transacao/${estornoId}?aviso=estornada`);
}
