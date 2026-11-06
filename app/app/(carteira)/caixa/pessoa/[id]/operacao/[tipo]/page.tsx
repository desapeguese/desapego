import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { obterSaldo } from "@/lib/ledger";
import { obterPessoa } from "@/lib/pessoas";
import { Topo } from "../../../../../topo";
import type { TipoOperacao } from "../../../../acoes";
import { exigirEquipe } from "../../../../equipe";
import { Operacao } from "./operacao";

// Na tela o Caixa "paga" e "recebe"; no livro os tipos continuam `dar` e
// `tomar`, que é como o PRD e o histórico já gravado os chamam.
const TIPOS: Record<string, { tipo: TipoOperacao; titulo: string }> = {
  pagar: { tipo: "dar", titulo: "Pagar" },
  receber: { tipo: "tomar", titulo: "Receber" },
  deposito: { tipo: "deposito_cedula", titulo: "Depósito" },
  saque: { tipo: "saque_cedula", titulo: "Saque" },
};

export default async function PaginaOperacao({
  params,
}: {
  params: Promise<{ id: string; tipo: string }>;
}) {
  const ator = await exigirEquipe();
  const { id, tipo: caminho } = await params;
  const escolhida = TIPOS[caminho];
  if (!escolhida) notFound();

  const pessoa = await obterPessoa(db, ator, id);
  if (!pessoa) notFound();
  const ficha = `/app/caixa/pessoa/${id}`;
  const tira = escolhida.tipo === "tomar" || escolhida.tipo === "saque_cedula";
  if (ator.id === id || !pessoa.ativo || (tira && ator.papel === "caixa" && pessoa.papel === "admin")) {
    redirect(ficha);
  }

  const { disponivel } = await obterSaldo(db, ator.id);

  return (
    <>
      <Topo titulo={escolhida.titulo} voltar={{ href: ficha, rotulo: "Voltar à pessoa" }} />
      <Operacao
        tipo={escolhida.tipo}
        alvo={{ id, nome: pessoa.nome || "Sem nome", saldo: pessoa.saldo }}
        disponivelDoCaixa={disponivel}
      />
    </>
  );
}
