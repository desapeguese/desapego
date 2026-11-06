import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { obterPessoa, podeGerenciar } from "@/lib/pessoas";
import { Topo } from "../../../../topo";
import { editar } from "../../../acoes";
import { exigirEquipe } from "../../../equipe";
import { FormularioPessoa } from "../../../formulario-pessoa";

export default async function EditarPessoa({ params }: { params: Promise<{ id: string }> }) {
  const ator = await exigirEquipe();
  const { id } = await params;
  const pessoa = await obterPessoa(db, ator, id);
  if (!pessoa) notFound();
  if (!podeGerenciar(ator, pessoa)) redirect(`/app/caixa/pessoa/${id}`);

  return (
    <>
      <Topo titulo="Editar dados" voltar={{ href: `/app/caixa/pessoa/${id}`, rotulo: "Voltar à pessoa" }} />
      <FormularioPessoa
        acao={editar}
        id={id}
        inicial={{ nome: pessoa.nome, email: pessoa.email, telefone: pessoa.telefone ?? "" }}
        botao="Salvar alterações"
        avisoEmail="Trocar o e-mail muda o login: a pessoa sai do app em todos os aparelhos, e o e-mail antigo é avisado."
      />
    </>
  );
}
