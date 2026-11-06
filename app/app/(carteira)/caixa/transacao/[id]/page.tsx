import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dataHora, inteiro, NOME_TIPO, numeroCurto } from "@/lib/formato";
import { obterTransacaoCompleta, podeEstornar } from "@/lib/ledger";
import { Avatar, Nota, tamanhoDoNumero } from "../../../../pecas";
import { Topo } from "../../../topo";
import { exigirEquipe, VOLTAR_AO_CAIXA } from "../../equipe";
import { FormularioEstorno } from "./formulario-estorno";

export default async function TransacaoDoCaixa({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const ator = await exigirEquipe();
  const { id } = await params;
  const t = await obterTransacaoCompleta(db, id);
  if (!t) notFound();

  const valorTexto = inteiro(t.valor);
  const estornavel = podeEstornar(ator, t);
  const pessoa = (pessoaId: string, nome: string) => (
    <Link className="pessoa-link" href={`/app/caixa/pessoa/${pessoaId}`}>
      <Avatar id={pessoaId} nome={nome || "?"} tamanho="pequeno" />
      <span>{nome || "Sem nome"}</span>
    </Link>
  );

  return (
    <>
      <Topo titulo="Transação" voltar={VOLTAR_AO_CAIXA} />

      {(await searchParams).aviso === "estornada" && (
        <p className="feito" role="status">Estorno registrado. Esta é a transação do estorno.</p>
      )}

      <div className="canhoto">
        <Nota
          rotuloDaSecao="Valor"
          rotulo={<p className="rotulo">{NOME_TIPO[t.tipo].toLowerCase()}</p>}
          valor={
            <p className="nota-valor">
              <span className="nota-moeda">D$</span>
              <span className={tamanhoDoNumero(valorTexto, "nota-numero")}>{valorTexto}</span>
            </p>
          }
          serie={`Nº ${numeroCurto(t.id)}`}
          rotuloDaSerie="Transação"
        />
        <div className="canhoto-picote" aria-hidden="true" />
        <dl className="ficha">
          <div>
            <dt>saiu de</dt>
            <dd>{pessoa(t.deConta, t.deNome)}</dd>
          </div>
          <div>
            <dt>entrou em</dt>
            <dd>{pessoa(t.paraConta, t.paraNome)}</dd>
          </div>
          <div>
            <dt>feita por</dt>
            <dd>{t.operadorNome || "Sem nome"}</dd>
          </div>
          {t.descricao && (
            <div>
              <dt>{t.tipo === "estorno" ? "motivo" : "descrição"}</dt>
              <dd>{t.descricao}</dd>
            </div>
          )}
          <div>
            <dt>quando</dt>
            <dd>{dataHora(t.criadaEm)}</dd>
          </div>
          {t.estornoDe && (
            <div>
              <dt>estorno de</dt>
              <dd>
                <Link href={`/app/caixa/transacao/${t.estornoDe}`}>{numeroCurto(t.estornoDe)}</Link>
              </dd>
            </div>
          )}
          {t.estornadaPor && (
            <div>
              <dt>estornada por</dt>
              <dd>
                <Link href={`/app/caixa/transacao/${t.estornadaPor}`}>{numeroCurto(t.estornadaPor)}</Link>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {estornavel ? (
        <FormularioEstorno id={t.id} />
      ) : (
        <p className="app-aviso">
          {t.tipo === "estorno"
            ? "Um estorno não pode ser estornado."
            : t.estornadaPor
              ? "Esta transação já foi estornada."
              : "Só quem fez esta operação, ou um Admin, pode estorná-la."}
        </p>
      )}
    </>
  );
}
