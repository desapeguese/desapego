/**
 * E-mail transacional via Resend, pela API HTTP (sem SDK).
 *
 * Sem RESEND_API_KEY, fora de produção, a mensagem vai para o console: dá para
 * desenvolver e ler o código de login no terminal. Em produção a falta da chave
 * é um erro, para ninguém ficar esperando um e-mail que nunca sai.
 */
export async function enviarEmail(msg: { para: string; assunto: string; texto: string }) {
  const chave = process.env.RESEND_API_KEY;
  const de = process.env.EMAIL_FROM ?? "Moeda Desapego <desapego@festivaldesapeguese.com.br>";

  if (!chave) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY não configurada: e-mail não enviado.");
    }
    console.log(`\n[e-mail] para ${msg.para}: ${msg.assunto}\n${msg.texto}\n`);
    return;
  }

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: de, to: [msg.para], subject: msg.assunto, text: msg.texto }),
  });
  if (!resposta.ok) {
    throw new Error(`Resend respondeu ${resposta.status}: ${await resposta.text()}`);
  }
}
