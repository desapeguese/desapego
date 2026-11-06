import Link from "next/link";

/** Cabeçalho das telas internas: botão redondo de voltar à esquerda, título no centro. */
export function Topo({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <header className="app-topo">
      <div className="topo-linha">
        <Link className="voltar" href="/app" aria-label="Voltar à carteira">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="app-titulo">{titulo}</h1>
        {/* Mesmo tamanho do botão, para o título ficar centrado na tela. */}
        <span className="topo-contrapeso" aria-hidden="true" />
      </div>
      {children}
    </header>
  );
}
