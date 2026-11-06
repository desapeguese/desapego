import { redirect } from "next/navigation";
import { pessoaLogada } from "@/lib/sessao";
import { FormularioCadastro } from "./formulario";

export default async function Cadastro() {
  const pessoa = await pessoaLogada();
  if (!pessoa) redirect("/app/entrar");
  if (pessoa.termosAceitosEm) redirect("/app");

  return (
    <>
      <header className="app-topo">
        <h1 className="app-titulo">Complete seu cadastro</h1>
        <p className="app-subtitulo">Falta pouco para sua carteira ficar pronta.</p>
      </header>
      <FormularioCadastro nome={pessoa.name} telefone={pessoa.telefone ?? ""} email={pessoa.email} />
    </>
  );
}
