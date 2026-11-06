import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Qualquer banco Postgres do Drizzle com o nosso esquema. O app usa
 * node-postgres; os testes usam PGlite. O livro (lib/ledger.ts) aceita ambos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Banco = PgDatabase<any, typeof schema>;

// O hot reload do `next dev` reavalia este módulo; sem o cache em globalThis
// cada recarga abriria um pool novo.
const global = globalThis as unknown as { __desapegoPool?: Pool };

// Criar o Pool não conecta: sem DATABASE_URL o build e a landing seguem
// funcionando, e só as rotas que consultam o banco falham.
const pool =
  global.__desapegoPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PGPOOL_MAX ?? 10),
  });

if (process.env.NODE_ENV !== "production") global.__desapegoPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
