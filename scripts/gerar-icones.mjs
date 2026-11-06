// Gera os ícones do PWA a partir de um desenho vetorial: o "1" da cédula, em
// creme sobre o verde. Rode de novo (e suba o sufixo -vN, por causa do cache
// imutável) se o desenho mudar: node scripts/gerar-icones.mjs
import sharp from "sharp";

const VERDE = "#053017";
const CREME = "#e9edd5";

// `area` é a fração do quadro ocupada pelo numeral: menor no ícone "maskable",
// que o Android recorta em círculo.
const desenho = (area) => {
  const e = area / 0.62;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${VERDE}"/>
  <g transform="translate(256 256) scale(${e}) translate(-256 -256)">
    <path fill="${CREME}" d="M214 98h92v316h-78V186l-58 30v-70z"/>
  </g>
</svg>`;
};

const gerar = (arquivo, tamanho, area) =>
  sharp(Buffer.from(desenho(area)), { density: 300 }).resize(tamanho, tamanho).png().toFile(arquivo);

await gerar("public/icone-192-v1.png", 192, 0.62);
await gerar("public/icone-512-v1.png", 512, 0.62);
await gerar("public/icone-mascara-512-v1.png", 512, 0.46);
await gerar("app/apple-icon.png", 180, 0.62);
console.log("ícones gerados.");
