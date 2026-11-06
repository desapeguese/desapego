// Gera os ícones do PWA e o favicon a partir do símbolo do Festival
// (public/logo-simbolo-v1.png, recortado do logo oficial do manual da marca).
// Rode de novo, subindo o sufixo -vN por causa do cache imutável, se o símbolo
// mudar: node scripts/gerar-icones.mjs
import sharp from "sharp";

const PAPEL = "#e8ecdf";
const SIMBOLO = "public/logo-simbolo-v1.png";

// `area` é a fração do quadro ocupada pelo símbolo: menor no ícone "maskable",
// que o Android recorta em círculo.
async function gerar(arquivo, tamanho, area) {
  const lado = Math.round(tamanho * area);
  const simbolo = await sharp(SIMBOLO).resize(lado, lado, { fit: "inside" }).toBuffer();
  await sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: PAPEL } })
    .composite([{ input: simbolo, gravity: "centre" }])
    .png()
    .toFile(arquivo);
}

await gerar("public/icone-192-v2.png", 192, 0.78);
await gerar("public/icone-512-v2.png", 512, 0.78);
await gerar("public/icone-mascara-512-v2.png", 512, 0.56);
await gerar("app/apple-icon.png", 180, 0.78);
await gerar("app/icon.png", 192, 0.82);
console.log("ícones gerados.");
