"use client";

import { useState } from "react";
import { inteiro, moeda } from "@/lib/formato";
import type { Grao, PontoDaSerie } from "@/lib/relatorios";

// As duas séries, validadas contra o papel do app (contraste >= 3:1 e
// distinguíveis em daltonismo). A identidade nunca depende só da cor: há
// legenda, dica ao tocar e a tabela logo abaixo.
const SERIES = [
  { chave: "emitido", nome: "Emitido", cor: "#34681A" },
  { chave: "recolhido", nome: "Recolhido", cor: "#5C4B9B" },
] as const;

const L = 358; // largura do desenho (a tela de celular menos as margens)
const A = 220;
const MARGEM = { topo: 12, direita: 4, base: 26, esquerda: 38 };

/** Um teto "redondo" para o eixo: 1, 2 ou 5 vezes uma potência de dez. */
function tetoRedondo(maximo: number): number {
  if (maximo <= 4) return 4;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  for (const m of [1, 2, 4, 5, 10]) if (m * potencia >= maximo) return m * potencia;
  return 10 * potencia;
}

function rotulo(inicio: string, grao: Grao): string {
  const [ano, mes, dia] = inicio.split("-");
  if (grao === "mes") return `${mes}/${ano.slice(2)}`;
  return `${dia}/${mes}`;
}

const NOME_GRAO: Record<Grao, string> = { dia: "dia", semana: "semana de", mes: "mês" };

export function GraficoPeriodo({ serie, grao }: { serie: PontoDaSerie[]; grao: Grao }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  if (serie.length === 0) return null;

  const maximo = Math.max(...serie.flatMap((p) => [p.emitido, p.recolhido]));
  const teto = tetoRedondo(maximo);
  const areaL = L - MARGEM.esquerda - MARGEM.direita;
  const areaA = A - MARGEM.topo - MARGEM.base;
  const faixa = areaL / serie.length;
  // Colunas finas: no máximo 24px, e nunca enchendo a faixa.
  const largura = Math.max(1.5, Math.min(24, (faixa - 4) / 2 - 1));
  const y = (valor: number) => MARGEM.topo + areaA - (valor / teto) * areaA;
  const base = MARGEM.topo + areaA;
  const marcas = [0, teto / 2, teto];
  // Rótulos do eixo só onde cabem: uns 6 ao longo da largura.
  const passo = Math.max(1, Math.ceil(serie.length / 6));
  const escolhido = ativo === null ? null : serie[ativo];

  /** Coluna com o topo arredondado e a base reta, saindo da linha de base. */
  const coluna = (x: number, valor: number) => {
    const topo = y(valor);
    const altura = base - topo;
    if (altura <= 0) return "";
    const r = Math.min(4, largura / 2, altura);
    return `M${x},${base}V${topo + r}a${r},${r} 0 0 1 ${r},${-r}h${largura - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${base}Z`;
  };

  return (
    <figure className="grafico">
      <figcaption className="grafico-legenda">
        {SERIES.map((s) => (
          <span key={s.chave}>
            <i style={{ background: s.cor }} aria-hidden="true" />
            {s.nome}
          </span>
        ))}
      </figcaption>

      <div className="grafico-quadro">
        <svg
          viewBox={`0 0 ${L} ${A}`}
          role="img"
          aria-label={`Colunas de Desapegos emitidos e recolhidos por ${grao === "mes" ? "mês" : grao}. Os valores estão na tabela abaixo.`}
          // Só o mouse "sai": no toque o navegador dispara este evento ao
          // levantar o dedo, e a dica sumiria antes de ser lida.
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setAtivo(null);
          }}
        >
          {marcas.map((m) => (
            <g key={m}>
              <line x1={MARGEM.esquerda} x2={L - MARGEM.direita} y1={y(m)} y2={y(m)} className="grafico-grade" />
              <text x={MARGEM.esquerda - 6} y={y(m)} className="grafico-eixo" textAnchor="end" dominantBaseline="middle">
                {inteiro(m)}
              </text>
            </g>
          ))}

          {serie.map((p, i) => {
            const centro = MARGEM.esquerda + faixa * i + faixa / 2;
            return (
              <g key={p.inicio}>
                {ativo === i && (
                  <rect x={centro - faixa / 2} y={MARGEM.topo} width={faixa} height={areaA} className="grafico-destaque" />
                )}
                <path d={coluna(centro - largura - 1, p.emitido)} fill={SERIES[0].cor} />
                <path d={coluna(centro + 1, p.recolhido)} fill={SERIES[1].cor} />
                {i % passo === 0 && (
                  <text x={centro} y={A - 8} className="grafico-eixo" textAnchor="middle">
                    {rotulo(p.inicio, grao)}
                  </text>
                )}
                {/* Alvo de toque: a faixa inteira, bem maior que as colunas. */}
                <rect
                  x={centro - faixa / 2}
                  y={MARGEM.topo}
                  width={faixa}
                  height={areaA + MARGEM.base}
                  fill="transparent"
                  onPointerEnter={() => setAtivo(i)}
                  onPointerDown={() => setAtivo(i)}
                />
              </g>
            );
          })}
        </svg>

        <p className="grafico-dica" role="status">
          {escolhido ? (
            <>
              <strong>
                {NOME_GRAO[grao]} {rotulo(escolhido.inicio, grao)}
              </strong>
              <span>
                <i style={{ background: SERIES[0].cor }} aria-hidden="true" />
                emitido {moeda(escolhido.emitido)}
              </span>
              <span>
                <i style={{ background: SERIES[1].cor }} aria-hidden="true" />
                recolhido {moeda(escolhido.recolhido)}
              </span>
              <span>entre pessoas {moeda(escolhido.entrePessoas)}</span>
            </>
          ) : (
            "Toque numa coluna para ver os valores."
          )}
        </p>
      </div>

      <details className="grafico-tabela">
        <summary>Ver os números em tabela</summary>
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">{grao === "mes" ? "Mês" : grao === "semana" ? "Semana de" : "Dia"}</th>
              <th scope="col" className="numero">Emitido</th>
              <th scope="col" className="numero">Recolhido</th>
              <th scope="col" className="numero">Entre pessoas</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((p) => (
              <tr key={p.inicio}>
                <th scope="row">{rotulo(p.inicio, grao)}</th>
                <td className="numero">{inteiro(p.emitido)}</td>
                <td className="numero">{inteiro(p.recolhido)}</td>
                <td className="numero">{inteiro(p.entrePessoas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
