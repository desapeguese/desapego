import Link from "next/link";
import { db } from "@/lib/db";
import { dataHora } from "@/lib/formato";
import { listarAuditoriaGlobal } from "@/lib/pessoas";
import { exigirPessoa } from "@/lib/sessao";
import { descreverAuditoria } from "../../caixa/auditoria-texto";
import { Topo } from "../../topo";

const POR_PAGINA = 50;

export default async function Auditoria({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ator = await exigirPessoa({ papeis: ["admin"] });
  const pagina = Math.max(Number.parseInt((await searchParams).p ?? "1", 10) || 1, 1);
  // Uma a mais, só para saber se existe próxima página.
  const linhas = await listarAuditoriaGlobal(db, ator, { limite: POR_PAGINA + 1, pular: (pagina - 1) * POR_PAGINA });
  const temMais = linhas.length > POR_PAGINA;

  return (
    <>
      <Topo titulo="Registro" voltar={{ href: "/app/admin", rotulo: "Voltar ao Admin" }}>
        <p className="app-subtitulo">Mudanças de perfil, limites, dados de contato, contas desativadas e estornos.</p>
      </Topo>

      {linhas.length === 0 ? (
        <p className="vazio">Nada registrado{pagina > 1 ? " nesta página" : " ainda"}.</p>
      ) : (
        <ul className="auditoria">
          {linhas.slice(0, POR_PAGINA).map((linha) => (
            <li key={linha.id}>
              <span>
                {linha.alvoId ? (
                  <>
                    <Link href={`/app/caixa/pessoa/${linha.alvoId}`}>{linha.alvoNome || "Sem nome"}</Link>:{" "}
                  </>
                ) : null}
                {descreverAuditoria(linha)}
              </span>
              <small>
                {dataHora(linha.criadaEm)} · {linha.atorNome ?? "sistema"}
              </small>
            </li>
          ))}
        </ul>
      )}

      <p className="ver-mais">
        {pagina > 1 && <Link href={`/app/admin/auditoria?p=${pagina - 1}`}>← Mais recentes</Link>}
        {temMais && <Link href={`/app/admin/auditoria?p=${pagina + 1}`}>Mais antigas →</Link>}
      </p>
    </>
  );
}
