import { redirect } from "next/navigation";
import { googleAtivo } from "@/lib/auth";
import { pessoaLogada } from "@/lib/sessao";
import { FormularioEntrar } from "./formulario";

export default async function Entrar() {
  if (await pessoaLogada()) redirect("/app");

  return (
    <>
      <header className="app-topo">
        <p className="sobrenome">Moeda Social Desapego</p>
        <h1 className="app-titulo">Entrar</h1>
        <p className="app-subtitulo">
          Sem senha: você recebe um código por e-mail. Se ainda não tem conta,
          ela é criada agora.
        </p>
      </header>
      <FormularioEntrar googleAtivo={googleAtivo} />
    </>
  );
}
