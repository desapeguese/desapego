import { inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { enviarEmail } from "./email";
import { publicar } from "./eventos";
import { moeda, NOME_TIPO } from "./formato";
import type { Transacao } from "./ledger";

/**
 * Avisa as pontas de uma transação que não foram quem a fez: na tela, se o app
 * estiver aberto, e por e-mail. Nunca falha a operação: erros só vão para o log.
 */
export function avisarMovimento(t: Transacao, operador: { id: string; nome: string }) {
  const pontas = [t.deConta, t.paraConta].filter((id) => id !== operador.id);
  if (pontas.length === 0) return;

  for (const id of pontas) {
    publicar(id, {
      tipo: id === t.paraConta ? "recebido" : "debitado",
      transacaoId: t.id,
      valor: t.valor,
      de: operador.nome,
    });
  }

  void (async () => {
    const destinos = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(inArray(schema.user.id, pontas));
    const base = (process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "");

    for (const destino of destinos) {
      const entrou = destino.id === t.paraConta;
      const oQue = t.tipo === "envio" ? "" : `${NOME_TIPO[t.tipo]}. `;
      await enviarEmail({
        para: destino.email,
        assunto: entrou
          ? `Você recebeu ${moeda(t.valor)} de ${operador.nome}`
          : `Saíram ${moeda(t.valor)} da sua carteira Desapego`,
        texto:
          (entrou
            ? `${oQue}${operador.nome} creditou ${moeda(t.valor)} na sua carteira da Moeda Desapego.`
            : `${oQue}${operador.nome} debitou ${moeda(t.valor)} da sua carteira da Moeda Desapego.`) +
          (t.descricao ? `\n\nDescrição: ${t.descricao}` : "") +
          `\n\nVeja o comprovante: ${base}/app/transacao/${t.id}` +
          (entrou ? "" : "\n\nNão reconhece? Procure o Caixa do Festival com o comprovante."),
      }).catch((erro) => console.error("[aviso de movimento] e-mail não enviado:", erro));
    }
  })().catch((erro) => console.error("[aviso de movimento]", erro));
}

/** Avisa o e-mail ANTIGO de que os dados de contato da conta foram trocados. */
export function avisarDadosAlterados(emailAntigo: string, campos: string[], operadorNome: string) {
  enviarEmail({
    para: emailAntigo,
    assunto: "Os dados da sua carteira Desapego foram alterados",
    texto:
      `${operadorNome}, da equipe do Caixa, alterou ${campos.join(" e ")} da sua carteira da Moeda Desapego.\n\n` +
      "Se foi você quem pediu, não precisa fazer nada.\n" +
      "Se não foi, procure a organização do Festival o quanto antes.",
  }).catch((erro) => console.error("[aviso de dados alterados] e-mail não enviado:", erro));
}

const NOME_PERFIL: Record<string, string> = { usuario: "Usuário", caixa: "Caixa", admin: "Admin" };

/** Avisa a pessoa de que o perfil dela mudou. */
export function avisarPerfilAlterado(email: string, de: string, para: string, operadorNome: string) {
  enviarEmail({
    para: email,
    assunto: "Seu perfil na Moeda Desapego mudou",
    texto:
      `${operadorNome} alterou o seu perfil na Moeda Desapego de ${NOME_PERFIL[de] ?? de} para ${NOME_PERFIL[para] ?? para}.\n\n` +
      "Se você não esperava essa mudança, procure a organização do Festival.",
  }).catch((erro) => console.error("[aviso de perfil alterado] e-mail não enviado:", erro));
}

/** Avisa a pessoa de que a proteção (passkey, autenticador) da conta foi removida. */
export function avisarSegundoFatorRemovido(email: string, operadorNome: string) {
  enviarEmail({
    para: email,
    assunto: "A proteção da sua carteira Desapego foi removida",
    texto:
      `${operadorNome}, da administração, removeu a entrada com digital/rosto e o app autenticador da sua carteira da Moeda Desapego.\n\n` +
      "Você volta a entrar só com o código por e-mail e pode ativar a proteção de novo em Sua conta > Segurança.\n" +
      "Se você não pediu isso, procure a organização do Festival o quanto antes.",
  }).catch((erro) => console.error("[aviso de segundo fator removido] e-mail não enviado:", erro));
}
