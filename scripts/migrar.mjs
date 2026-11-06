// Aplica as migrações de ./drizzle. Roda antes do `next start` em produção.
//
// Sem DATABASE_URL sai com sucesso em vez de falhar: a landing não depende do
// banco e não pode cair porque ele ainda não foi provisionado.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrar] DATABASE_URL ausente: migrações puladas, o app (/app) não vai funcionar.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("[migrar] banco atualizado.");
} finally {
  await pool.end();
}
