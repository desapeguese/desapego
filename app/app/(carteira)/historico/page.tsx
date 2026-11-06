import Link from "next/link";
import { db } from "@/lib/db";
import { listarExtrato } from "@/lib/ledger";
import { exigirPessoa } from "@/lib/sessao";
import { Navegacao } from "../../pecas";
import { Extrato } from "../extrato";
import { Topo } from "../topo";

export default async function Historico({
  searchParams,
}: {
  searchParams: Promise<{ a?: string | string[] }>;
}) {
  const pessoa = await exigirPessoa();
  const { a } = await searchParams;
  const cursor = (Array.isArray(a) ? a[0] : a) ?? null;
  const { linhas, proximo } = await listarExtrato(db, pessoa.id, { limite: 30, cursor });

  return (
    <>
      <Topo titulo="Histórico" />

      {linhas.length === 0 ? (
        <p className="vazio">{cursor ? "Não há trocas mais antigas." : "Nenhuma troca ainda."}</p>
      ) : (
        <Extrato linhas={linhas} />
      )}

      <p className="ver-mais">
        {cursor && <Link href="/app/historico">Voltar ao início</Link>}
        {proximo && (
          <Link href={`/app/historico?a=${encodeURIComponent(proximo)}`}>Mais antigas →</Link>
        )}
      </p>
      <Navegacao atual="historico" />
    </>
  );
}
