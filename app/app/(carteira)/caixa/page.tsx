import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { dataHora, inteiro, moeda, NOME_TIPO, numeroCurto } from "@/lib/formato";
import { buscarTransacoesPorNumero, listarExtrato, obterSaldo } from "@/lib/ledger";
import { buscarPessoas } from "@/lib/pessoas";
import { Nota, tamanhoDoNumero } from "../../pecas";
import { Extrato } from "../extrato";
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

  const [pessoas, { saldoCaixa, disponivelCaixa }, movimentos] = await Promise.all([
    buscarPessoas(db, ator, termo),
    obterSaldo(db, ator.id),
    listarExtrato(db, ator.id, { lado: "caixa", limite: 5 }),
  ]);
  const saldoTexto = `${saldoCaixa < 0 ? "−" : ""}${inteiro(Math.abs(saldoCaixa))}`;

  return (
    <>
      <Topo titulo="Modo Caixa" voltar={{ href: "/app", rotulo: "Sair do modo Caixa" }} />

      <Nota
        rotuloDaSecao="Saldo do caixa"
        rotulo={<p className="rotulo">saldo do seu caixa</p>}
        valor={
          <p className="nota-valor">
            <span className="nota-moeda">D$</span>
            <span className={tamanhoDoNumero(saldoTexto, "nota-numero")}>{saldoTexto}</span>
          </p>
        }
        pe={
          <p className="nota-pe">
            {disponivelCaixa === null ? "sem limite" : `você ainda pode distribuir ${moeda(disponivelCaixa)}`}
            <small>À parte do seu saldo pessoal, que você vê ao sair do modo Caixa.</small>
          </p>
        }
      />

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

      <section aria-labelledby="titulo-movimentos">
        <div className="secao-cabeca">
          <h2 className="secao-titulo" id="titulo-movimentos">Seu caixa</h2>
          {movimentos.proximo && <Link href="/app/caixa/movimentos">ver tudo</Link>}
        </div>
        {movimentos.linhas.length === 0 ? (
          <p className="vazio">Você ainda não fez operações no modo Caixa.</p>
        ) : (
          <Extrato linhas={movimentos.linhas} base="/app/caixa/transacao" />
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

      <div className="rodape-acao">
        <Link className="botao botao--contorno" href="/app">Sair do modo Caixa</Link>
      </div>
    </>
  );
}
