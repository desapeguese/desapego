import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { limparFiltros, type Filtros } from "@/lib/relatorios";

export type Parametros = Record<string, string | string[] | undefined>;

const um = (v?: string | string[]) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

async function idPorEmail(email: string): Promise<string | null> {
  const [achada] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email.toLowerCase()));
  return achada?.id ?? null;
}

/**
 * Os filtros do relatório a partir da URL. Operador e usuário chegam como
 * e-mail; um e-mail que não existe vira um filtro que não acha nada, com aviso,
 * em vez de ser ignorado (o que mostraria tudo e enganaria quem lê).
 */
export async function lerFiltros(parametros: Parametros): Promise<{
  filtros: Filtros;
  texto: { de: string; ate: string; tipo: string; operador: string; usuario: string };
  avisos: string[];
  /** Os mesmos filtros, para montar links (CSV, paginação). */
  consulta: URLSearchParams;
}> {
  const texto = {
    de: um(parametros.de),
    ate: um(parametros.ate),
    tipo: um(parametros.tipo),
    operador: um(parametros.operador),
    usuario: um(parametros.usuario),
  };
  const avisos: string[] = [];
  // Um id que nenhuma conta tem.
  const NINGUEM = "-ninguem-";

  let operadorId: string | undefined;
  if (texto.operador) {
    operadorId = (await idPorEmail(texto.operador)) ?? NINGUEM;
    if (operadorId === NINGUEM) avisos.push(`Não existe conta com o e-mail “${texto.operador}” (operador).`);
  }
  let usuarioId: string | undefined;
  if (texto.usuario) {
    usuarioId = (await idPorEmail(texto.usuario)) ?? NINGUEM;
    if (usuarioId === NINGUEM) avisos.push(`Não existe conta com o e-mail “${texto.usuario}” (usuário).`);
  }

  const filtros = limparFiltros({ de: texto.de, ate: texto.ate, tipo: texto.tipo, operadorId, usuarioId });
  if (texto.de && !filtros.de) avisos.push("Data inicial inválida: ignorada.");
  if (texto.ate && !filtros.ate) avisos.push("Data final inválida: ignorada.");

  const consulta = new URLSearchParams();
  for (const [chave, valor] of Object.entries(texto)) if (valor) consulta.set(chave, valor);
  return { filtros, texto, avisos, consulta };
}
