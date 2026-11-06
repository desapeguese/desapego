import Link from "next/link";
import { db } from "@/lib/db";
import { corDaPessoa, iniciais, inteiro, moeda, numeroDeSerie } from "@/lib/formato";
import { listarExtrato, obterSaldo } from "@/lib/ledger";
import { exigirPessoa } from "@/lib/sessao";
import { Marca, Navegacao, Nota, tamanhoDoNumero } from "../pecas";
import { Extrato } from "./extrato";
import { Instalar } from "./instalar";

export default async function Carteira() {
  const pessoa = await exigirPessoa();
  const [{ saldo, disponivel, numero }, { linhas, proximo }] = await Promise.all([
    obterSaldo(db, pessoa.id),
    listarExtrato(db, pessoa.id, { limite: 5 }),
  ]);
  const saldoTexto = `${saldo < 0 ? "−" : ""}${inteiro(Math.abs(saldo))}`;

  return (
    <>
      <header className="cabecalho">
        <Marca />
        <Link
          className="avatar avatar--grande"
          href="/app/conta"
          aria-label={`Sua conta: ${pessoa.name}`}
          style={{ background: corDaPessoa(pessoa.id) }}
        >
          {iniciais(pessoa.name)}
        </Link>
      </header>

      <Nota
        rotuloDaSecao="Saldo"
        rotulo={<p className="rotulo">seu saldo</p>}
        valor={
          <p className="nota-valor">
            <span className="nota-moeda">D$</span>
            <span className={tamanhoDoNumero(saldoTexto, "nota-numero")}>{saldoTexto}</span>
          </p>
        }
        pe={
          <p className="nota-pe">
            {pessoa.name}
            {pessoa.papel === "caixa" && disponivel !== null && (
              <small>Caixa · pode distribuir {moeda(disponivel)}</small>
            )}
            {pessoa.papel === "admin" && <small>Admin · sem limite negativo</small>}
          </p>
        }
        serie={numeroDeSerie(pessoa.createdAt, numero)}
        rotuloDaSerie="Número da conta"
      />

      <nav className="acoes" aria-label="Ações">
        <Link className="botao" href="/app/receber">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v14" />
            <path d="M6 12l6 6 6-6" />
            <path d="M5 21h14" />
          </svg>
          Receber
        </Link>
        <Link className="botao botao--lima" href="/app/enviar">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20V6" />
            <path d="M6 12l6-6 6 6" />
            <path d="M5 3h14" />
          </svg>
          Enviar
        </Link>
      </nav>

      <section aria-labelledby="titulo-ultimas">
        <div className="secao-cabeca">
          <h2 className="secao-titulo" id="titulo-ultimas">Últimas trocas</h2>
          {proximo && <Link href="/app/historico">ver tudo</Link>}
        </div>
        {linhas.length === 0 ? (
          <p className="vazio">
            Nada por aqui ainda. Leve um objeto ao bazar do Festival ou peça para
            alguém te enviar Desapegos.
          </p>
        ) : (
          <Extrato linhas={linhas} />
        )}
      </section>

      <Instalar />
      <Navegacao atual="carteira" />
    </>
  );
}
