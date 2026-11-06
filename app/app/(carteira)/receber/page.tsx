import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { CORES_DA_RODA, numeroDeSerie } from "@/lib/formato";
import { obterSaldo } from "@/lib/ledger";
import { exigirPessoa } from "@/lib/sessao";
import { Topo } from "../topo";

/** Endereço público do app: o configurado ou, na falta, o do próprio pedido. */
async function enderecoBase(): Promise<string> {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
  return `${cabecalhos.get("x-forwarded-proto") ?? "http"}://${host}`;
}

// As doze pessoas da roda, de mãos dadas em volta do QR (viewBox 330).
const PESSOAS = Array.from({ length: 12 }, (_, i) => {
  const angulo = (i * Math.PI) / 6;
  return {
    cx: (165 + 128 * Math.cos(angulo)).toFixed(1),
    cy: (165 + 128 * Math.sin(angulo)).toFixed(1),
    cor: CORES_DA_RODA[i % CORES_DA_RODA.length],
  };
});
const LEMA = "a riqueza está em circular · ".repeat(4).trim();

export default async function Receber() {
  const pessoa = await exigirPessoa();
  const { numero } = await obterSaldo(db, pessoa.id);

  // O QR é um link: lido de dentro do app cai direto no envio; lido pela câmera
  // do celular abre o app na mesma tela.
  const link = `${await enderecoBase()}/app/enviar?para=${encodeURIComponent(pessoa.id)}`;
  // Correção de erro baixa e margem mínima deixam os módulos maiores, e o
  // disco branco em volta já faz a zona de silêncio.
  const qr = await QRCode.toString(link, {
    type: "svg",
    errorCorrectionLevel: "L",
    margin: 1,
    color: { dark: "#143D20", light: "#ffffff" },
  });

  return (
    <>
      <Topo titulo="Receber">
        <p className="app-subtitulo">Mostre a roda para quem vai te enviar Desapegos.</p>
      </Topo>

      <div className="roda">
        <svg viewBox="0 0 330 330" aria-hidden="true">
          <defs>
            <path id="roda-volta" d="M 165,14 a 151,151 0 1,1 -0.01,0" />
          </defs>
          <text
            style={{ fontFamily: "var(--titulo)", fontWeight: 600, fontSize: 14, letterSpacing: 1.5 }}
            fill="#1F5A2E"
          >
            <textPath href="#roda-volta" textLength="940">{LEMA}</textPath>
          </text>
          <circle cx="165" cy="165" r="128" fill="none" stroke="#1F5A2E" strokeWidth="3" />
          <g stroke="#1F5A2E" strokeWidth="2">
            {PESSOAS.map((p) => (
              <circle key={`${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} r="11" fill={p.cor} />
            ))}
          </g>
          <circle cx="165" cy="165" r="112" fill="#ffffff" />
        </svg>
        <div
          className="roda-qr"
          role="img"
          aria-label={`QR code da carteira de ${pessoa.name}`}
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      </div>

      <div className="receber-quem">
        <p className="receber-nome">{pessoa.name}</p>
        <p className="receber-email">{pessoa.email}</p>
        <p className="serie">{numeroDeSerie(pessoa.createdAt, numero)}</p>
      </div>

      <p className="aguardando" role="status">
        Aguardando. O aviso aparece aqui na hora em que o valor chegar.
      </p>
    </>
  );
}
