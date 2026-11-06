import type { TipoTransacao } from "./db/schema";

const numero = new Intl.NumberFormat("pt-BR");
const data = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** "1.234" — sem o símbolo, para quem quer estilizar o D$ à parte. */
export const inteiro = (valor: number) => numero.format(valor);
/** "D$ 1.234", ou "D$ −70" com o sinal de menos tipográfico. */
export const moeda = (valor: number) => `D$ ${valor < 0 ? "−" : ""}${numero.format(Math.abs(valor))}`;
/** "+ D$ 20" / "− D$ 20" */
export const moedaComSinal = (valor: number) =>
  `${valor < 0 ? "−" : "+"} D$ ${numero.format(Math.abs(valor))}`;
export const dataHora = (instante: Date) => data.format(instante);

export const NOME_TIPO: Record<TipoTransacao, string> = {
  envio: "Transferência",
  dar: "Crédito do Caixa",
  tomar: "Débito do Caixa",
  deposito_cedula: "Depósito de cédulas",
  saque_cedula: "Saque em cédulas",
  estorno: "Estorno",
};

/** "DES-2026-00412": o número de série da conta, no formato da cédula. */
export const numeroDeSerie = (criadaEm: Date, numero: number) =>
  `DES-${criadaEm.getFullYear()}-${String(numero).padStart(5, "0")}`;

/** "7F3A-91C2": os 8 primeiros dígitos do identificador da transação. */
export const numeroCurto = (transacaoId: string) => {
  const hex = transacaoId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
};

/** "MS" para "Maria da Silva": primeira letra do primeiro e do último nome. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/**
 * As cores das pessoas da roda: as secundárias do manual da marca (rosa, azul,
 * laranja, roxo) e o verde médio, rebaixadas para dar contraste com as
 * iniciais em tinta escura.
 */
export const CORES_DA_RODA = ["#EC90B5", "#8FC5E4", "#F5AC5C", "#A69DCA", "#92C56E"];

/** A cor de uma pessoa: sempre a mesma para o mesmo id. */
export function corDaPessoa(id: string): string {
  let soma = 0;
  for (let i = 0; i < id.length; i++) soma = (soma * 31 + id.charCodeAt(i)) >>> 0;
  return CORES_DA_RODA[soma % CORES_DA_RODA.length];
}
