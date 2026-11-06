import Link from "next/link";
import { corDaPessoa, iniciais } from "@/lib/formato";

/** "moeda social / DESAPEGO", como no canto da cédula. */
export function Marca() {
  return (
    <p className="marca" style={{ margin: 0 }}>
      <span className="marca-sobre">moeda social</span>
      <span className="marca-nome">DESAPEGO</span>
    </p>
  );
}

/** A pessoa como uma das figuras da roda: círculo na cor dela, com as iniciais. */
export function Avatar(props: {
  id: string;
  nome: string;
  tamanho?: "pequeno" | "grande";
  contorno?: boolean;
}) {
  const classes = ["avatar"];
  if (props.tamanho) classes.push(`avatar--${props.tamanho}`);
  if (props.contorno) classes.push("avatar--contorno");
  return (
    <span className={classes.join(" ")} style={{ background: corDaPessoa(props.id) }} aria-hidden="true">
      {iniciais(props.nome)}
    </span>
  );
}

/** O Caixa do bazar no extrato: uma barraca no lugar das iniciais. */
export function AvatarCaixa() {
  return (
    <span className="avatar avatar--caixa" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9l1.5-4h13L20 9" />
        <path d="M4 9v10h16V9" />
        <path d="M4 9h16" />
        <path d="M10 19v-5h4v5" />
      </svg>
    </span>
  );
}

/** A faixa de círculos da cédula, na lateral de tudo o que mostra um valor. */
export function Nota(props: {
  rotulo: React.ReactNode;
  valor: React.ReactNode;
  pe?: React.ReactNode;
  serie?: string;
  rotuloDaSerie?: string;
  rotuloDaSecao?: string;
}) {
  return (
    <section className="nota" aria-label={props.rotuloDaSecao}>
      <div className="nota-faixa guilhoche" aria-hidden="true" />
      <div className="nota-corpo">
        {props.rotulo}
        {props.valor}
        {props.pe}
      </div>
      {props.serie && (
        <p className="nota-serie serie" aria-label={`${props.rotuloDaSerie ?? "Número"} ${props.serie}`}>
          {props.serie}
        </p>
      )}
    </section>
  );
}

/** Classe de tamanho do numeral conforme o comprimento do texto. */
export function tamanhoDoNumero(texto: string, base: string): string {
  if (texto.length >= 8) return `${base} ${base}--longo`;
  if (texto.length >= 5) return `${base} ${base}--medio`;
  return base;
}

/** Barra inferior: Carteira, ler QR (no centro) e Histórico. */
export function Navegacao({ atual }: { atual: "carteira" | "historico" }) {
  return (
    <>
      <div className="navegacao-espaco" aria-hidden="true" />
      <nav className="navegacao" aria-label="Principal">
        <div className="navegacao-itens">
          <Link className="navegacao-item" href="/app" aria-current={atual === "carteira" ? "page" : undefined}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2.5" />
              <path d="M3 10h18" />
              <circle cx="16.5" cy="14.5" r="1.2" />
            </svg>
            Carteira
          </Link>
          <Link className="navegacao-ler" href="/app/enviar" aria-label="Ler QR code para enviar">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8V5a1 1 0 0 1 1-1h3" />
              <path d="M16 4h3a1 1 0 0 1 1 1v3" />
              <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
              <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </Link>
          <Link className="navegacao-item" href="/app/historico" aria-current={atual === "historico" ? "page" : undefined}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h12" />
              <path d="M8 12h12" />
              <path d="M8 18h12" />
              <circle cx="4" cy="6" r="1" />
              <circle cx="4" cy="12" r="1" />
              <circle cx="4" cy="18" r="1" />
            </svg>
            Histórico
          </Link>
        </div>
      </nav>
    </>
  );
}
