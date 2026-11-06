import { Topo } from "../../topo";
import { cadastrar } from "../acoes";
import { exigirEquipe, VOLTAR_AO_CAIXA } from "../equipe";
import { FormularioPessoa } from "../formulario-pessoa";

export default async function NovaPessoa() {
  await exigirEquipe();
  return (
    <>
      <Topo titulo="Cadastrar" voltar={VOLTAR_AO_CAIXA}>
        <p className="app-subtitulo">
          A pessoa já pode receber. Os termos de uso ela aceita quando entrar no app pela primeira vez.
        </p>
      </Topo>
      <FormularioPessoa acao={cadastrar} inicial={{ nome: "", email: "", telefone: "" }} botao="Cadastrar pessoa" />
    </>
  );
}
