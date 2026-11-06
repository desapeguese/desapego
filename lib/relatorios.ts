import { sql, type SQL } from "drizzle-orm";
import type { Banco } from "./db";
import { conta, transacao, user, TIPOS_TRANSACAO, type TipoTransacao } from "./db/schema";
import { verificarIntegridade } from "./ledger";

/**
 * Relatórios do Admin (seção 4.4 do PRD). Só leitura. Quem chama é que garante
 * que o pedido vem de um Admin; aqui não há sessão.
 */

/** Dias no fuso do Festival: "hoje" é o dia de quem está no evento, não o UTC. */
const FUSO = "America/Sao_Paulo";

export type Filtros = {
  /** Datas "AAAA-MM-DD", inclusivas, no horário de Brasília. */
  de?: string;
  ate?: string;
  tipo?: TipoTransacao;
  /** Quem apertou o botão. */
  operadorId?: string;
  /** Quem aparece numa das duas pontas. */
  usuarioId?: string;
};

const ehData = (v?: string): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Descarta o que não for um filtro válido, em vez de falhar: a entrada vem da URL. */
export function limparFiltros(bruto: Record<string, string | undefined>): Filtros {
  const filtros: Filtros = {};
  if (ehData(bruto.de)) filtros.de = bruto.de;
  if (ehData(bruto.ate)) filtros.ate = bruto.ate;
  if (TIPOS_TRANSACAO.includes(bruto.tipo as TipoTransacao)) filtros.tipo = bruto.tipo as TipoTransacao;
  if (bruto.operadorId) filtros.operadorId = bruto.operadorId;
  if (bruto.usuarioId) filtros.usuarioId = bruto.usuarioId;
  return filtros;
}

function condicao(f: Filtros): SQL {
  const partes: SQL[] = [sql`true`];
  if (f.de) partes.push(sql`t.criada_em >= (${f.de}::timestamp at time zone ${FUSO})`);
  if (f.ate) partes.push(sql`t.criada_em < ((${f.ate}::date + 1)::timestamp at time zone ${FUSO})`);
  if (f.tipo) partes.push(sql`t.tipo = ${f.tipo}`);
  if (f.operadorId) partes.push(sql`t.operador_id = ${f.operadorId}`);
  if (f.usuarioId) partes.push(sql`(t.de_conta = ${f.usuarioId} or t.para_conta = ${f.usuarioId})`);
  return sql.join(partes, sql` and `);
}

const linhas = <T>(resultado: unknown) =>
  (resultado && typeof resultado === "object" && "rows" in resultado
    ? (resultado as { rows: unknown[] }).rows
    : resultado) as T[];

export type ResumoPeriodo = {
  transacoes: number;
  /** Soma do valor de todas as transações do filtro. */
  volume: number;
  /** Pessoas diferentes que aparecem numa das pontas. */
  pessoasAtivas: number;
  depositadoEmCedulas: number;
  sacadoEmCedulas: number;
  porTipo: { tipo: TipoTransacao; transacoes: number; volume: number }[];
};

export async function resumirPeriodo(db: Banco, filtros: Filtros): Promise<ResumoPeriodo> {
  const onde = condicao(filtros);
  const porTipo = linhas<{ tipo: TipoTransacao; transacoes: number; volume: number }>(
    await db.execute(sql`
      select t.tipo, count(*)::int as transacoes, coalesce(sum(t.valor), 0)::int as volume
      from ${transacao} t where ${onde}
      group by t.tipo order by volume desc, t.tipo
    `),
  );
  const [{ pessoas }] = linhas<{ pessoas: number }>(
    await db.execute(sql`
      select count(distinct p)::int as pessoas from (
        select t.de_conta as p from ${transacao} t where ${onde}
        union all
        select t.para_conta from ${transacao} t where ${onde}
      ) pontas
    `),
  );
  const de = (tipo: TipoTransacao) => porTipo.find((l) => l.tipo === tipo)?.volume ?? 0;
  return {
    transacoes: porTipo.reduce((soma, l) => soma + l.transacoes, 0),
    volume: porTipo.reduce((soma, l) => soma + l.volume, 0),
    pessoasAtivas: pessoas,
    depositadoEmCedulas: de("deposito_cedula"),
    sacadoEmCedulas: de("saque_cedula"),
    porTipo,
  };
}

export type SaldoDestaque = { id: string; nome: string; papel: string; saldo: number };

/** A fotografia de agora: não depende de período. */
export async function retratoAtual(db: Banco) {
  const [totais] = linhas<{
    pessoas: number;
    ativas: number;
    positivo: number;
    negativo: number;
    organizacao: number;
  }>(
    await db.execute(sql`
      select count(*)::int as pessoas,
             count(*) filter (where u.ativo)::int as ativas,
             coalesce(sum(c.saldo) filter (where c.saldo > 0), 0)::int as positivo,
             coalesce(sum(c.saldo) filter (where c.saldo < 0), 0)::int as negativo,
             coalesce(sum(c.saldo) filter (where c.saldo < 0 and u.papel <> 'usuario'), 0)::int as organizacao
      from ${user} u left join ${conta} c on c.usuario_id = u.id
    `),
  );
  const destaque = async (ordem: SQL, filtro: SQL) =>
    linhas<SaldoDestaque>(
      await db.execute(sql`
        select u.id, u.name as nome, u.papel, c.saldo
        from ${conta} c join ${user} u on u.id = c.usuario_id
        where ${filtro} order by ${ordem}, u.name limit 10
      `),
    );
  const [maioresPositivos, maioresNegativos, integridade] = [
    await destaque(sql`c.saldo desc`, sql`c.saldo > 0`),
    await destaque(sql`c.saldo asc`, sql`c.saldo < 0`),
    await verificarIntegridade(db),
  ];
  return {
    pessoas: totais.pessoas,
    pessoasAtivas: totais.ativas,
    /** Moeda em circulação: quanto as pessoas têm a receber em objetos. */
    somaPositivos: totais.positivo,
    somaNegativos: totais.negativo,
    /** Saldo negativo de Caixas e Admins: a emissão feita pela organização. */
    negativoDaOrganizacao: totais.organizacao,
    maioresPositivos,
    maioresNegativos,
    integridade,
  };
}

export type LinhaRelatorio = {
  id: string;
  criadaEm: Date;
  tipo: TipoTransacao;
  valor: number;
  descricao: string;
  estornoDe: string | null;
  deId: string;
  deNome: string;
  deEmail: string;
  paraId: string;
  paraNome: string;
  paraEmail: string;
  operadorNome: string;
  operadorEmail: string;
};

/** Transações do filtro, da mais recente para a mais antiga. `cursor` como em listarExtrato. */
export async function listarTransacoes(
  db: Banco,
  filtros: Filtros,
  opcoes: { limite?: number; cursor?: string | null } = {},
): Promise<{ linhas: LinhaRelatorio[]; proximo: string | null }> {
  const limite = Math.min(Math.max(opcoes.limite ?? 50, 1), 5000);
  let aPartirDe = sql`true`;
  if (opcoes.cursor) {
    const [instante, id] = opcoes.cursor.split("|");
    if (!instante || !id || Number.isNaN(Date.parse(instante)) || !/^[0-9a-f-]{36}$/.test(id)) {
      return { linhas: [], proximo: null };
    }
    aPartirDe = sql`(t.criada_em, t.id) < (${instante}::timestamptz, ${id}::uuid)`;
  }

  const brutas = linhas<Record<string, never>>(
    await db.execute(sql`
      select t.id, t.criada_em, t.criada_em::text as cursor_instante, t.tipo, t.valor, t.descricao, t.estorno_de,
             t.de_conta, de.name as de_nome, de.email as de_email,
             t.para_conta, para.name as para_nome, para.email as para_email,
             op.name as operador_nome, op.email as operador_email
      from ${transacao} t
      join ${user} de on de.id = t.de_conta
      join ${user} para on para.id = t.para_conta
      join ${user} op on op.id = t.operador_id
      where ${condicao(filtros)} and ${aPartirDe}
      order by t.criada_em desc, t.id desc
      limit ${limite + 1}
    `),
  );
  const pagina = brutas.slice(0, limite);
  const ultima = pagina.at(-1);
  return {
    linhas: pagina.map((b) => ({
      id: b.id,
      criadaEm: new Date(b.criada_em),
      tipo: b.tipo,
      valor: b.valor,
      descricao: b.descricao,
      estornoDe: b.estorno_de,
      deId: b.de_conta,
      deNome: b.de_nome,
      deEmail: b.de_email,
      paraId: b.para_conta,
      paraNome: b.para_nome,
      paraEmail: b.para_email,
      operadorNome: b.operador_nome,
      operadorEmail: b.operador_email,
    })),
    proximo: brutas.length > limite && ultima ? `${ultima.cursor_instante}|${ultima.id}` : null,
  };
}

/**
 * Uma célula de CSV. Além das aspas, neutraliza fórmulas: uma descrição que
 * comece com = + - @ seria executada pelo Excel de quem abrir o relatório.
 */
export function celulaCsv(valor: string | number | null): string {
  if (valor === null) return "";
  if (typeof valor === "number") return String(valor);
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Ponto e vírgula como separador: é o que o Excel em português espera. */
export const linhaCsv = (celulas: (string | number | null)[]) => celulas.map(celulaCsv).join(";") + "\r\n";

// ---------------------------------------------------------------------------
// Série por período (o gráfico)
// ---------------------------------------------------------------------------

export const GRAOS = ["dia", "semana", "mes"] as const;
export type Grao = (typeof GRAOS)[number];
const TRUNC: Record<Grao, string> = { dia: "day", semana: "week", mes: "month" };

export type PontoDaSerie = {
  /** Primeiro dia do período, "AAAA-MM-DD" (a semana começa na segunda). */
  inicio: string;
  /** Entrou em circulação: Caixa pagou ou recebeu cédulas. */
  emitido: number;
  /** Saiu de circulação: Caixa recebeu ou entregou cédulas. */
  recolhido: number;
  /** Trocas entre pessoas: não mudam o total em circulação. */
  entrePessoas: number;
};

function proximoInicio(inicio: string, grao: Grao): string {
  const d = new Date(`${inicio}T00:00:00Z`);
  if (grao === "dia") d.setUTCDate(d.getUTCDate() + 1);
  else if (grao === "semana") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Emissão e recolhimento por dia, semana ou mês (horário de Brasília), com os
 * períodos vazios preenchidos com zero. Um estorno conta no sentido contrário
 * ao da transação que ele desfaz.
 */
export async function seriePorPeriodo(db: Banco, filtros: Filtros, grao: Grao): Promise<PontoDaSerie[]> {
  const brutas = linhas<PontoDaSerie>(
    await db.execute(sql`
      select to_char(date_trunc(${TRUNC[grao]}, t.criada_em at time zone ${FUSO}), 'YYYY-MM-DD') as inicio,
        coalesce(sum(t.valor) filter (where t.tipo in ('dar', 'deposito_cedula')
          or (t.tipo = 'estorno' and o.tipo in ('tomar', 'saque_cedula'))), 0)::int as emitido,
        coalesce(sum(t.valor) filter (where t.tipo in ('tomar', 'saque_cedula')
          or (t.tipo = 'estorno' and o.tipo in ('dar', 'deposito_cedula'))), 0)::int as recolhido,
        coalesce(sum(t.valor) filter (where t.tipo = 'envio'
          or (t.tipo = 'estorno' and o.tipo = 'envio')), 0)::int as "entrePessoas"
      from ${transacao} t
      left join ${transacao} o on o.id = t.estorno_de
      where ${condicao(filtros)}
      group by 1 order by 1
    `),
  );
  if (brutas.length === 0) return [];

  const porInicio = new Map(brutas.map((p) => [p.inicio, p]));
  const serie: PontoDaSerie[] = [];
  const ultimo = brutas[brutas.length - 1].inicio;
  // Teto de segurança: um intervalo absurdo não vira um laço sem fim.
  for (let dia = brutas[0].inicio; dia <= ultimo && serie.length < 1000; dia = proximoInicio(dia, grao)) {
    serie.push(porInicio.get(dia) ?? { inicio: dia, emitido: 0, recolhido: 0, entrePessoas: 0 });
  }
  return serie;
}

/** O grão que deixa o gráfico legível para o intervalo: no máximo ~45 colunas. */
export function graoSugerido(de: string, ate: string): Grao {
  const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000 + 1;
  if (dias <= 45) return "dia";
  return dias <= 45 * 7 ? "semana" : "mes";
}
