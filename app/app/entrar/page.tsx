import { redirect } from "next/navigation";
import { cadastroAberto, googleAtivo } from "@/lib/auth";
import { pessoaLogada } from "@/lib/sessao";
import { FormularioEntrar } from "./formulario";

export default async function Entrar() {
  if (await pessoaLogada()) redirect("/app");

  return (
    <>
      <div className="entrada-notas">
        {/* A da roda de pessoas (o verso) fica por cima. */}
        <img className="entrada-nota--tras" src="/cedula-frente-v2.webp" width={916} height={414} alt="" />
        <img
          className="entrada-nota--cima"
          src="/cedula-verso-v2.webp"
          width={916}
          height={414}
          alt="Cédula de 1 Desapego, com uma roda de pessoas de mãos dadas em volta de objetos trocados e o lema “a riqueza está em circular”"
        />
      </div>

      <img
        className="entrada-logo"
        src="/logo-festival-cor-v1.png"
        width={900}
        height={313}
        alt="Desapegue-se, o Festival dos Futuros que Queremos"
      />

      <header className="entrada-texto">
        <p className="rotulo">moeda social Desapego</p>
        <h1 className="app-titulo" style={{ textAlign: "left" }}>A riqueza está em circular</h1>
        {cadastroAberto ? (
          <p>
            Entre sem senha: enviamos um código para o seu e-mail. Se ainda não
            tem carteira, ela nasce agora.
          </p>
        ) : (
          <p className="feito">
            O cadastro abre em breve. Por enquanto só a equipe do Festival consegue entrar.
          </p>
        )}
      </header>

      <FormularioEntrar googleAtivo={googleAtivo && cadastroAberto} />
    </>
  );
}
