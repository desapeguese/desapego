import { redirect } from "next/navigation";
import { googleAtivo } from "@/lib/auth";
import { pessoaLogada } from "@/lib/sessao";
import { FormularioEntrar } from "./formulario";

export default async function Entrar() {
  if (await pessoaLogada()) redirect("/app");

  return (
    <>
      <div className="entrada-notas">
        <img className="entrada-nota--verso" src="/cedula-verso-v2.webp" width={916} height={414} alt="" />
        <img
          className="entrada-nota--frente"
          src="/cedula-frente-v2.webp"
          width={916}
          height={414}
          alt="Cédula de 1 Desapego, com uma roda de pessoas de mãos dadas ao redor do símbolo da reciclagem"
        />
      </div>

      <header className="entrada-texto">
        <p className="rotulo">moeda social Desapego</p>
        <h1 className="app-titulo" style={{ textAlign: "left" }}>A riqueza está em circular</h1>
        <p>
          Entre sem senha: enviamos um código para o seu e-mail. Se ainda não
          tem carteira, ela nasce agora.
        </p>
      </header>

      <FormularioEntrar googleAtivo={googleAtivo} />
    </>
  );
}
