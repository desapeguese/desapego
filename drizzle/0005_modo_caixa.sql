CREATE TABLE "acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario_id" text NOT NULL,
	"ip" text,
	"agente" text
);
--> statement-breakpoint
ALTER TABLE "transacao" DROP CONSTRAINT "transacao_tipo_valido";--> statement-breakpoint
ALTER TABLE "conta" ADD COLUMN "saldo_caixa" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "transacao" ADD COLUMN "de_caixa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transacao" ADD COLUMN "para_caixa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "acesso" ADD CONSTRAINT "acesso_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acesso_usuario_idx" ON "acesso" USING btree ("usuario_id","criado_em");--> statement-breakpoint
CREATE INDEX "acesso_data_idx" ON "acesso" USING btree ("criado_em");--> statement-breakpoint
ALTER TABLE "transacao" ADD CONSTRAINT "transacao_tipo_valido" CHECK ("transacao"."tipo" in ('envio', 'dar', 'tomar', 'deposito_cedula', 'saque_cedula', 'estorno', 'fechamento_caixa'));--> statement-breakpoint
-- Converte o histórico para os dois saldos. É a única vez em que o livro é
-- reescrito, e só nas duas colunas novas: as operações de balcão já feitas
-- passam a apontar para o saldo de caixa de quem as fez.
ALTER TABLE "transacao" DISABLE TRIGGER transacao_sem_update_delete;--> statement-breakpoint
UPDATE "transacao" SET "de_caixa" = true WHERE "tipo" IN ('dar', 'deposito_cedula');--> statement-breakpoint
UPDATE "transacao" SET "para_caixa" = true WHERE "tipo" IN ('tomar', 'saque_cedula');--> statement-breakpoint
UPDATE "transacao" e SET "de_caixa" = o."para_caixa", "para_caixa" = o."de_caixa"
  FROM "transacao" o WHERE e."tipo" = 'estorno' AND o."id" = e."estorno_de";--> statement-breakpoint
ALTER TABLE "transacao" ENABLE TRIGGER transacao_sem_update_delete;--> statement-breakpoint
UPDATE "conta" c SET "saldo_caixa" = m.total, "saldo" = c."saldo" - m.total
  FROM (
    SELECT conta_id, sum(delta)::int AS total FROM (
      SELECT "para_conta" AS conta_id, "valor" AS delta FROM "transacao" WHERE "para_caixa"
      UNION ALL
      SELECT "de_conta", -"valor" FROM "transacao" WHERE "de_caixa"
    ) lados GROUP BY conta_id
  ) m WHERE m.conta_id = c."usuario_id";--> statement-breakpoint
-- O limite individual passa a valer só para o saldo de caixa de quem é Caixa.
UPDATE "conta" c SET "limite_negativo" = NULL
  FROM "user" u WHERE u."id" = c."usuario_id" AND u."papel" <> 'caixa';
