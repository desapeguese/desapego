import Link from "next/link";
import { db } from "@/lib/db";
import { listarExtrato } from "@/lib/ledger";
import { Extrato } from "../../extrato";
import { Topo } from "../../topo";
import { exigirEquipe, VOLTAR_AO_CAIXA } from "../equipe";

/** Tudo o que a pessoa logada movimentou no modo Caixa. */
export default async function MovimentosDoCaixa({
  searchParams,
}: {
  searchParams: Promise<{ a?: string | string[] }>;
}) {
  const ator = await exigirEquipe();
  const { a } = await searchParams;
  const cursor = (Array.isArray(a) ? a[0] : a) ?? null;
  const { linhas, proximo } = await listarExtrato(db, ator.id, { lado: "caixa", limite: 30, cursor });

  return (
    <>
      <Topo titulo="Seu caixa" voltar={VOLTAR_AO_CAIXA} />
      {linhas.length === 0 ? (
        <p className="vazio">{cursor ? "Não há operações mais antigas." : "Nenhuma operação no modo Caixa ainda."}</p>
      ) : (
        <Extrato linhas={linhas} base="/app/caixa/transacao" />
      )}
      <p className="ver-mais">
        {cursor && <Link href="/app/caixa/movimentos">Voltar ao início</Link>}
        {proximo && <Link href={`/app/caixa/movimentos?a=${encodeURIComponent(proximo)}`}>Mais antigas →</Link>}
      </p>
    </>
  );
}
