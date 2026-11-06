import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dataHora, inteiro, NOME_TIPO, numeroCurto } from "@/lib/formato";
import { obterTransacaoDe } from "@/lib/ledger";
import { exigirPessoa } from "@/lib/sessao";
import { Avatar, Nota, tamanhoDoNumero } from "../../../pecas";
import { Topo } from "../../topo";

export default async function Transacao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviada?: string }>;
}) {
  const pessoa = await exigirPessoa();
  const { id } = await params;
  const transacao = await obterTransacaoDe(db, pessoa.id, id);
  if (!transacao) notFound();

  const entrou = transacao.valor > 0;
  const recemEnviada = (await searchParams).enviada === "1" && !entrou;
  const numero = numeroCurto(transacao.id);
  const valorTexto = inteiro(Math.abs(transacao.valor));
  const nome = transacao.contraparteNome || "Sem nome";

  return (
    <>
      {recemEnviada ? (
        <header className="comprovante-topo">
          <span className="carimbo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h1 className="app-titulo">Enviado!</h1>
          <p>A riqueza circulou.</p>
        </header>
      ) : (
        <Topo titulo="Comprovante" />
      )}

      <div className="canhoto">
        <Nota
          rotuloDaSecao="Valor"
          rotulo={<p className="rotulo">{entrou ? "você recebeu" : "você enviou"}</p>}
          valor={
            <p className="nota-valor">
              <span className="nota-moeda">D$</span>
              <span className={tamanhoDoNumero(valorTexto, "nota-numero")}>{valorTexto}</span>
            </p>
          }
          serie={`Nº ${numero}`}
          rotuloDaSerie="Transação"
        />
        <div className="canhoto-picote" aria-hidden="true" />
        <dl className="ficha">
          <div>
            <dt>{entrou ? "de" : "para"}</dt>
            <dd>
              <Avatar id={transacao.contraparteId} nome={nome} tamanho="pequeno" />
              {nome}
            </dd>
          </div>
          {transacao.tipo !== "envio" && (
            <div>
              <dt>tipo</dt>
              <dd>{NOME_TIPO[transacao.tipo]}</dd>
            </div>
          )}
          {transacao.descricao && (
            <div>
              <dt>pelo quê</dt>
              <dd>{transacao.descricao}</dd>
            </div>
          )}
          <div>
            <dt>quando</dt>
            <dd>{dataHora(transacao.criadaEm)}</dd>
          </div>
        </dl>
      </div>

      <p className="app-aviso">
        Algo errado? Mostre o número <strong>{numero}</strong> ao Caixa para pedir o estorno.
      </p>

      <div className="rodape-acao">
        <Link className="botao" href="/app">Voltar à carteira</Link>
        {!entrou && transacao.tipo === "envio" && (
          <Link className="link" href={`/app/enviar?para=${encodeURIComponent(transacao.contraparteId)}`}>
            Enviar de novo
          </Link>
        )}
      </div>
    </>
  );
}
