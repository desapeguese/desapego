import Link from "next/link";
import { db } from "@/lib/db";
import { edicaoDoDia, listarEdicoes } from "@/lib/edicoes";
import { exigirPessoa } from "@/lib/sessao";
import { Topo } from "../../topo";
import { criar, remover, salvar } from "./acoes";

const AVISOS: Record<string, string> = {
  criada: "Edição criada.",
  alterada: "Edição atualizada.",
  removida: "Edição removida. As transações continuam no livro.",
};

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function Campos({ nome = "", inicio = "", fim = "" }: { nome?: string; inicio?: string; fim?: string }) {
  return (
    <>
      <label className="campo">
        <span>Nome</span>
        <input name="nome" required maxLength={80} placeholder="ex.: Festival Desapegue-se 2026" defaultValue={nome} />
      </label>
      <div className="campos-lado">
        <label className="campo">
          <span>Início</span>
          <input type="date" name="inicio" required defaultValue={inicio} />
        </label>
        <label className="campo">
          <span>Fim</span>
          <input type="date" name="fim" required defaultValue={fim} />
        </label>
      </div>
    </>
  );
}

export default async function Edicoes({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirPessoa({ papeis: ["admin"] });
  const [edicoes, atual, { aviso }] = await Promise.all([listarEdicoes(db), edicaoDoDia(db, hoje()), searchParams]);

  return (
    <>
      <Topo titulo="Edições" voltar={{ href: "/app/admin", rotulo: "Voltar ao Admin" }}>
        <p className="app-subtitulo">
          Servem para filtrar os relatórios. As transações funcionam o ano todo, dentro ou fora de uma edição.
        </p>
      </Topo>

      {aviso && AVISOS[aviso] && <p className="feito" role="status">{AVISOS[aviso]}</p>}
      {aviso?.startsWith("erro:") && (
        <p className="mensagem mensagem--erro" role="alert">{aviso.slice(5)}</p>
      )}

      <p className="app-aviso">
        {atual ? (
          <>
            Hoje está dentro da edição <strong>{atual.nome}</strong>.
          </>
        ) : (
          "Hoje não está dentro de nenhuma edição."
        )}
      </p>

      {edicoes.map((e) => (
        <section key={e.id} className="cartao edicao-form">
          <form className="edicao-form" action={salvar}>
            <input type="hidden" name="id" value={e.id} />
            <Campos nome={e.nome} inicio={e.inicio} fim={e.fim} />
            <button className="botao botao--contorno" type="submit">Salvar</button>
          </form>
          <div className="formulario-links">
            <Link className="link" href={`/app/admin/relatorio?edicao=${e.id}`}>Ver relatório</Link>
            <form action={remover}>
              <input type="hidden" name="id" value={e.id} />
              <button className="link" type="submit">Remover</button>
            </form>
          </div>
        </section>
      ))}

      <section aria-labelledby="titulo-nova">
        <h2 className="secao-titulo" id="titulo-nova">Nova edição</h2>
        <form className="edicao-form" action={criar} style={{ marginTop: 10 }}>
          <Campos />
          <button className="botao" type="submit">Criar edição</button>
        </form>
      </section>
    </>
  );
}
