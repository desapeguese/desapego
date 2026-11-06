import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { Verificacao } from "./verificacao";

/**
 * Para quem tem 2FA e entrou só com código de e-mail ou Google: falta provar
 * o segundo fator. Fica fora do grupo (carteira), que exige a prova.
 */
export default async function Verificar() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/app/entrar");
  if (!sessao.segundoFatorPendente) redirect("/app");

  return (
    <>
      <header className="app-topo">
        <h1 className="app-titulo">Confirme que é você</h1>
        <p className="app-subtitulo">
          Sua conta tem proteção extra. Para continuar neste aparelho, confirme com um dos jeitos abaixo.
        </p>
      </header>
      <Verificacao autenticadorAtivo={sessao.pessoa.twoFactorEnabled} email={sessao.pessoa.email} />
    </>
  );
}
