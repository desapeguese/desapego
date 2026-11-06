import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { dataHora, moeda, NOME_TIPO, numeroCurto } from "@/lib/formato";
import { buscarTransacoesPorNumero, obterSaldo } from "@/lib/ledger";
import { buscarPessoas } from "@/lib/pessoas";
import { Topo } from "../topo";
import { exigirEquipe } from "./equipe";
import { ListaPessoas } from "./lista-pessoas";

const um = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Caixa({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; n?: string | string[] }>;
}) {
  const ator = await exigirEquipe();
  const parametros = await searchParams;
  const termo = um(parametros.q).trim();
  const numero = um(parametros.n).trim();

  const transacoes = numero ? await buscarTransacoesPorNumero(db, numero) : [];
  if (transacoes.length === 1) redirect(`/app/caixa/transacao/${transacoes[0].id}`);

  const [pessoas, { saldo, disponivel }] = await Promise.all([
    buscarPessoas(db, ator, termo),
    obterSaldo(db, ator.id),
  ]);

  return (
    <>
      <Topo titulo="Caixa">
        <p className="app-subtitulo">
          Seu saldo: <strong>{moeda(saldo)}</strong>
          {disponivel === null ? " · sem limite" : ` · pode distribuir ${moeda(disponivel)}`}
        </p>
      </Topo>

      <nav className="acoes" aria-label="Atalhos do Caixa">
        <Link className="botao" href="/app/caixa/ler">Ler QR</Link>
        <Link className="botao botao--lima" href="/app/caixa/nova">Cadastrar</Link>
      </nav>

      <section aria-labelledby="titulo-pessoas">
        <form className="busca" action="/app/caixa" role="search">
          <label className="campo">
            <span id="titulo-pessoas">Pessoas</span>
            <input
              name="q"
              type="search"
              defaultValue={termo}
              placeholder="nome, e-mail, telefone ou nº da conta"
              autoComplete="off"
            />
          </label>
          <button className="botao" type="submit">Buscar</button>
        </form>

        {pessoas.length === 0 ? (
          <p className="vazio">
            Ninguém encontrado para “{termo}”. <Link href="/app/caixa/nova">Cadastrar uma pessoa nova</Link>
          </p>
        ) : (
          <>
            {!termo && <p className="rotulo lista-rotulo">cadastros mais recentes</p>}
            <ListaPessoas pessoas={pessoas} />
          </>
        )}
      </section>

      <section aria-labelledby="titulo-transacao">
        <form className="busca" action="/app/caixa">
          <label className="campo">
            <span id="titulo-transacao">Transação pelo número</span>
            <input name="n" defaultValue={numero} placeholder="910A-86B5" autoComplete="off" autoCapitalize="characters" />
          </label>
          <button className="botao botao--contorno" type="submit">Abrir</button>
        </form>
        {numero && transacoes.length === 0 && (
          <p className="vazio">Nenhuma transação com o número “{numero}”. Confira os 8 caracteres do comprovante.</p>
        )}
        {transacoes.length > 1 && (
          <ul className="extrato">
            {transacoes.map((t) => (
              <li key={t.id}>
                <Link className="extrato-linha" href={`/app/caixa/transacao/${t.id}`}>
                  <span className="extrato-texto">
                    <span className="extrato-nome">
                      {t.deNome} → {t.paraNome}
                    </span>
                    <span className="extrato-detalhe">
                      {numeroCurto(t.id)} · {NOME_TIPO[t.tipo]} · {dataHora(t.criadaEm)}
                    </span>
                  </span>
                  <span className="extrato-valor">{moeda(t.valor)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
