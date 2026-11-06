// Postgres de desenvolvimento sem Docker: PGlite (Postgres em WASM) servido no
// protocolo normal do Postgres, com os dados em ./.pglite.
//
// Todas as conexões compartilham uma única sessão do PGlite, então o app
// precisa de PGPOOL_MAX=1 para que transações não se misturem. Só para
// desenvolvimento.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const porta = Number(process.env.PGPORT ?? 5433);
const db = await PGlite.create(process.env.PGLITE_DIR ?? "./.pglite");
const servidor = new PGLiteSocketServer({ db, port: porta, host: "127.0.0.1" });
await servidor.start();
console.log(`Banco local em postgres://postgres@127.0.0.1:${porta}/postgres`);

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, async () => {
    await servidor.stop();
    await db.close();
    process.exit(0);
  });
}
