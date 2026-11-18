import Link from "next/link";
import { db } from "@/lib/db";
import { inteiro, moeda } from "@/lib/formato";
import { listarCaixas, listarEquipe, obterLimitePadraoCaixa } from "@/lib/pessoas";
import { retratoAtual, type SaldoDestaque } from "@/lib/relatorios";
import { exigirPessoa } from "@/lib/sessao";
import { Avatar } from "../../pecas";
import { ListaPessoas } from "../caixa/lista-pessoas";
import { Topo } from "../topo";
import { mudarLimitePadrao } from "./acoes";

function Destaques({ titulo, pessoas, vazio }: { titulo: string; pessoas: SaldoDestaque[]; vazio: string }) {
  return (
    <section>
      <h2 className="secao-titulo">{titulo}</h2>
      {pessoas.length === 0 ? (
        <p className="vazio">{vazio}</p>
      ) : (
        <ol className="extrato">
          {pessoas.map((p) => (
            <li key={p.id}>
              <Link className="extrato-linha" href={`/app/caixa/pessoa/${p.id}`}>
                <Avatar id={p.id} nome={p.nome || "?"} />
                <span className="extrato-texto">
                  <span className="extrato-nome">{p.nome || "Sem nome"}</span>
                  {p.papel !== "usuario" && (
                    <span className="extrato-detalhe">{p.papel === "admin" ? "Admin" : "Caixa"}</span>
                  )}
                </span>
                <span className="extrato-valor">{moeda(p.saldo)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const ator = await exigirPessoa({ papeis: ["admin"] });
  const [retrato, equipe, equipeECaixas, limitePadrao, { aviso }] = await Promise.all([
    retratoAtual(db),
    listarEquipe(db, ator),
    listarCaixas(db, ator),
    obterLimitePadraoCaixa(db),
    searchParams,
  ]);

  return (
    <>
      <Topo titulo="Admin" />

      {aviso === "limite" && <p className="feito" role="status">Limite padrão do Caixa atualizado.</p>}
      {aviso === "erro" && (
        <p className="mensagem mensagem--erro" role="alert">
          Limite inválido: use um número inteiro de 0 a 1.000.000.
        </p>
      )}

      <nav className="acoes acoes--tres" aria-label="Relatórios">
        <Link className="botao" href="/app/admin/relatorio">Transações</Link>
        <Link className="botao botao--contorno" href="/app/admin/auditoria">Registro</Link>
        <Link className="botao botao--contorno" href="/app/admin/edicoes">Edições</Link>
      </nav>

      <section aria-labelledby="titulo-retrato">
        <h2 className="secao-titulo" id="titulo-retrato">A moeda agora</h2>
        <dl className="indicadores">
          <div>
            <dt>em circulação</dt>
            <dd>{moeda(retrato.somaPositivos)}</dd>
            <small>soma dos saldos positivos</small>
          </div>
          <div>
            <dt>saldo dos caixas</dt>
            <dd>{moeda(retrato.saldoDosCaixas)}</dd>
            <small>o que o balcão emitiu, menos o que recolheu</small>
          </div>
          <div>
            <dt>pessoas</dt>
            <dd>{inteiro(retrato.pessoas)}</dd>
            <small>{inteiro(retrato.pessoasAtivas)} com conta ativa</small>
          </div>
          <div className={retrato.integridade.integro ? undefined : "indicador--alerta"}>
            <dt>soma de todos os saldos</dt>
            <dd>{moeda(retrato.integridade.somaSaldos)}</dd>
            <small>
              {retrato.integridade.integro
                ? "livro íntegro: a soma é zero e cada saldo bate com o histórico"
                : `ATENÇÃO: ${retrato.integridade.contasDivergentes.length} conta(s) com saldo diferente do histórico`}
            </small>
          </div>
        </dl>
      </section>

      <Destaques titulo="Maiores saldos positivos" pessoas={retrato.maioresPositivos} vazio="Ninguém com saldo positivo." />
      {retrato.maioresNegativos.length > 0 && (
        <Destaques titulo="Saldos pessoais negativos" pessoas={retrato.maioresNegativos} vazio="" />
      )}

      <section aria-labelledby="titulo-caixas">
        <h2 className="secao-titulo" id="titulo-caixas">Caixas</h2>
        <p className="mensagem">
          O saldo do modo Caixa de cada pessoa. Toque para ver tudo o que ela movimentou no balcão.
        </p>
        {equipeECaixas.length === 0 ? (
          <p className="vazio">Ninguém operou o balcão ainda.</p>
        ) : (
          <ul className="extrato">
            {equipeECaixas.map((p) => (
              <li key={p.id}>
                <Link className="extrato-linha" href={`/app/admin/relatorio?caixa=${encodeURIComponent(p.email)}`}>
                  <Avatar id={p.id} nome={p.nome || "?"} />
                  <span className="extrato-texto">
                    <span className="extrato-nome">{p.nome || "Sem nome"}</span>
                    <span className="extrato-detalhe">
                      {p.papel === "admin" ? "Admin" : p.papel === "caixa" ? "Caixa" : "não é mais Caixa"}
                      {!p.ativo && " · bloqueada"}
                    </span>
                  </span>
                  <span className="extrato-valor">{moeda(p.saldoCaixa)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-limite">
        <form className="busca" action={mudarLimitePadrao}>
          <label className="campo">
            <span id="titulo-limite">Limite padrão do Caixa (D$)</span>
            <input name="limite" inputMode="numeric" pattern="[0-9]*" required autoComplete="off" defaultValue={limitePadrao} />
          </label>
          <button className="botao botao--contorno" type="submit">Salvar</button>
        </form>
        <p className="mensagem lista-rotulo">
          Quanto o saldo de caixa de cada Caixa pode ficar negativo ao distribuir. Vale para todo Caixa sem limite
          individual; o individual se define na ficha da pessoa.
        </p>
      </section>

      <section aria-labelledby="titulo-equipe">
        <h2 className="secao-titulo" id="titulo-equipe">Equipe</h2>
        <ListaPessoas pessoas={equipe} />
        <p className="mensagem lista-rotulo">
          Para promover alguém, abra a ficha da pessoa pelo <Link href="/app/caixa">Caixa</Link> e mude o perfil.
        </p>
      </section>
    </>
  );
}
