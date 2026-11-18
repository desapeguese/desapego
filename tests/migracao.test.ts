import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import type { Banco } from "../lib/db";
import * as schema from "../lib/db/schema";
import { obterSaldo, verificarIntegridade } from "../lib/ledger";

/** Uma cópia de ./drizzle só com as primeiras `n` migrações. */
function pastaAte(n: number): string {
  const pasta = mkdtempSync(join(tmpdir(), "desapego-migracoes-"));
  cpSync("./drizzle", pasta, { recursive: true });
  const diario = JSON.parse(readFileSync(join(pasta, "meta/_journal.json"), "utf8"));
  diario.entries = diario.entries.slice(0, n);
  writeFileSync(join(pasta, "meta/_journal.json"), JSON.stringify(diario));
  return pasta;
}

describe("migração 0005 (modo Caixa)", () => {
  it("converte o histórico de um saldo para dois sem mudar o total de ninguém", async () => {
    const banco = drizzle(new PGlite(), { schema });
    const db = banco as unknown as Banco;
    // O banco como estava em produção antes da mudança: um saldo por conta.
    await migrate(banco, { migrationsFolder: pastaAte(5) });
    await db.execute(sql`
      insert into "user" (id, name, email, papel) values
        ('ana', 'Ana', 'ana@t.br', 'usuario'), ('bia', 'Bia', 'bia@t.br', 'usuario'),
        ('cx', 'Caixa', 'cx@t.br', 'caixa'), ('adm', 'Admin', 'adm@t.br', 'admin')
    `);
    // Saldos de então: ana 100−30+7−2 = 75; bia 30−20+20 = 30; cx −100+20+2−20 = −98; adm −7.
    await db.execute(sql`
      insert into conta (usuario_id, saldo, limite_negativo) values
        ('ana', 75, 40), ('bia', 30, null), ('cx', -98, 2000), ('adm', -7, null)
    `);

    // dar 100 (cx→ana), envio 30 (ana→bia), tomar 20 (bia→cx), depósito 7 (adm→ana),
    // saque 2 (ana→cx), e o estorno do tomar (cx→bia 20).
    await db.execute(sql`
      insert into transacao (id, tipo, de_conta, para_conta, valor, operador_id, chave_idempotencia, estorno_de) values
        ('00000000-0000-0000-0000-000000000001', 'dar', 'cx', 'ana', 100, 'cx', 'k1', null),
        ('00000000-0000-0000-0000-000000000002', 'envio', 'ana', 'bia', 30, 'ana', 'k2', null),
        ('00000000-0000-0000-0000-000000000003', 'tomar', 'bia', 'cx', 20, 'cx', 'k3', null),
        ('00000000-0000-0000-0000-000000000004', 'deposito_cedula', 'adm', 'ana', 7, 'adm', 'k4', null),
        ('00000000-0000-0000-0000-000000000005', 'saque_cedula', 'ana', 'cx', 2, 'cx', 'k5', null),
        ('00000000-0000-0000-0000-000000000006', 'estorno', 'cx', 'bia', 20, 'cx', 'k6', '00000000-0000-0000-0000-000000000003')
    `);

    await migrate(banco, { migrationsFolder: "./drizzle" });

    expect(await obterSaldo(db, "ana")).toMatchObject({ saldo: 75, saldoCaixa: 0 });
    expect(await obterSaldo(db, "bia")).toMatchObject({ saldo: 30, saldoCaixa: 0 });
    expect(await obterSaldo(db, "cx")).toMatchObject({ saldo: 0, saldoCaixa: -98, limiteCaixa: 2000 });
    expect(await obterSaldo(db, "adm")).toMatchObject({ saldo: 0, saldoCaixa: -7 });
    expect(await verificarIntegridade(db)).toMatchObject({ somaSaldos: 0, integro: true });

    const lados = (await db.execute(sql`select tipo, de_caixa, para_caixa from transacao order by id`)).rows;
    expect(lados).toEqual([
      { tipo: "dar", de_caixa: true, para_caixa: false },
      { tipo: "envio", de_caixa: false, para_caixa: false },
      { tipo: "tomar", de_caixa: false, para_caixa: true },
      { tipo: "deposito_cedula", de_caixa: true, para_caixa: false },
      { tipo: "saque_cedula", de_caixa: false, para_caixa: true },
      { tipo: "estorno", de_caixa: true, para_caixa: false },
    ]);
    // O limite de crédito de usuário comum deixa de existir; o do Caixa fica.
    const limites = (await db.execute(sql`select usuario_id, limite_negativo from conta order by usuario_id`)).rows;
    expect(limites).toEqual([
      { usuario_id: "adm", limite_negativo: null },
      { usuario_id: "ana", limite_negativo: null },
      { usuario_id: "bia", limite_negativo: null },
      { usuario_id: "cx", limite_negativo: 2000 },
    ]);
    // Depois da conversão o livro volta a ser imutável.
    await expect(db.execute(sql`update transacao set valor = 1`)).rejects.toThrow();
  });
});
