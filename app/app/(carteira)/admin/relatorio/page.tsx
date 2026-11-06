import Link from "next/link";
import { db } from "@/lib/db";
import { TIPOS_TRANSACAO } from "@/lib/db/schema";
import { dataHora, inteiro, moeda, NOME_TIPO, numeroCurto } from "@/lib/formato";
import { listarTransacoes, resumirPeriodo } from "@/lib/relatorios";
import { exigirPessoa } from "@/lib/sessao";
import { Topo } from "../../topo";
import { lerFiltros, type Parametros } from "./filtros";

/** "AAAA-MM-DD" de hoje menos `dias`, no horário de Brasília. */
function dia(dias: number): string {
  const agora = new Date(Date.now() - dias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export default async function Relatorio({ searchParams }: { searchParams: Promise<Parametros> }) {
  await exigirPessoa({ papeis: ["admin"] });
  const parametros = await searchParams;
  const { filtros, texto, avisos, consulta } = await lerFiltros(parametros);
  const cursor = typeof parametros.a === "string" ? parametros.a : null;

  const [resumo, { linhas, proximo }] = await Promise.all([
    resumirPeriodo(db, filtros),
    listarTransacoes(db, filtros, { limite: 50, cursor }),
  ]);

  const base = "/app/admin/relatorio";
  const comFiltros = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(consulta);
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  const periodo = (de: string) => {
    const q = new URLSearchParams(consulta);
    q.set("de", de);
    q.set("ate", dia(0));
    return `${base}?${q}`;
  };
  const semPeriodo = (() => {
    const q = new URLSearchParams(consulta);
    q.delete("de");
    q.delete("ate");
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  })();

  return (
    <>
      <Topo titulo="Transações" voltar={{ href: "/app/admin", rotulo: "Voltar ao Admin" }} />

      <form className="formulario cartao" action={base}>
        <div className="campos-lado">
          <label className="campo">
            <span>De</span>
            <input type="date" name="de" defaultValue={texto.de} />
          </label>
          <label className="campo">
            <span>Até</span>
            <input type="date" name="ate" defaultValue={texto.ate} />
          </label>
        </div>
        <p className="atalhos-periodo">
          <Link href={periodo(dia(0))}>hoje</Link>
          <Link href={periodo(dia(6))}>7 dias</Link>
          <Link href={periodo(dia(29))}>30 dias</Link>
          <Link href={semPeriodo}>tudo</Link>
        </p>
        <label className="campo">
          <span>Tipo</span>
          <select name="tipo" defaultValue={texto.tipo}>
            <option value="">Todos</option>
            {TIPOS_TRANSACAO.map((tipo) => (
              <option key={tipo} value={tipo}>{NOME_TIPO[tipo]}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Feita por (e-mail)</span>
          <input name="operador" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" defaultValue={texto.operador} />
        </label>
        <label className="campo">
          <span>Envolvendo (e-mail)</span>
          <input name="usuario" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" defaultValue={texto.usuario} />
        </label>
        <button className="botao" type="submit">Filtrar</button>
        {consulta.size > 0 && <Link className="link" href={base}>Limpar filtros</Link>}
      </form>

      {avisos.map((aviso) => (
        <p key={aviso} className="mensagem mensagem--erro" role="alert">{aviso}</p>
      ))}

      <section aria-labelledby="titulo-resumo">
        <h2 className="secao-titulo" id="titulo-resumo">Resumo do filtro</h2>
        <dl className="indicadores">
          <div>
            <dt>volume</dt>
            <dd>{moeda(resumo.volume)}</dd>
            <small>soma do valor das transações</small>
          </div>
          <div>
            <dt>transações</dt>
            <dd>{inteiro(resumo.transacoes)}</dd>
            <small>{inteiro(resumo.pessoasAtivas)} pessoas envolvidas</small>
          </div>
          <div>
            <dt>cédulas depositadas</dt>
            <dd>{moeda(resumo.depositadoEmCedulas)}</dd>
            <small>papel que virou saldo</small>
          </div>
          <div>
            <dt>cédulas sacadas</dt>
            <dd>{moeda(resumo.sacadoEmCedulas)}</dd>
            <small>saldo que virou papel</small>
          </div>
        </dl>

        {resumo.porTipo.length > 0 && (
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col" className="numero">Transações</th>
                <th scope="col" className="numero">Volume</th>
              </tr>
            </thead>
            <tbody>
              {resumo.porTipo.map((l) => (
                <tr key={l.tipo}>
                  <th scope="row">{NOME_TIPO[l.tipo]}</th>
                  <td className="numero">{inteiro(l.transacoes)}</td>
                  <td className="numero">{moeda(l.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="titulo-lista">
        <div className="secao-cabeca">
          <h2 className="secao-titulo" id="titulo-lista">Lista</h2>
          {resumo.transacoes > 0 && (
            <a href={`${base}/csv${comFiltros()}`} download>
              baixar CSV ({inteiro(resumo.transacoes)})
            </a>
          )}
        </div>
        {linhas.length === 0 ? (
          <p className="vazio">{cursor ? "Não há transações mais antigas." : "Nenhuma transação com esses filtros."}</p>
        ) : (
          <ul className="extrato">
            {linhas.map((t) => (
              <li key={t.id}>
                <Link className="extrato-linha" href={`/app/caixa/transacao/${t.id}`}>
                  <span className="extrato-texto">
                    <span className="extrato-nome">
                      {t.deNome || "Sem nome"} → {t.paraNome || "Sem nome"}
                    </span>
                    <span className="extrato-detalhe">
                      {NOME_TIPO[t.tipo]}
                      {t.descricao && !t.tipo.endsWith("_cedula") ? `: ${t.descricao}` : ""}
                    </span>
                    <span className="extrato-detalhe">
                      {numeroCurto(t.id)} · {dataHora(t.criadaEm)} · por {t.operadorNome || "Sem nome"}
                    </span>
                  </span>
                  <span className="extrato-valor">{inteiro(t.valor)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="ver-mais">
          {cursor && <Link href={`${base}${comFiltros()}`}>Voltar ao início</Link>}
          {proximo && <Link href={`${base}${comFiltros({ a: proximo })}`}>Mais antigas →</Link>}
        </p>
      </section>
    </>
  );
}
