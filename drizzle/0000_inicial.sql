CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ator_id" text,
	"alvo_id" text,
	"acao" text NOT NULL,
	"detalhes" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracao" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conta" (
	"usuario_id" text PRIMARY KEY NOT NULL,
	"saldo" integer DEFAULT 0 NOT NULL,
	"limite_negativo" integer,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conta_limite_nao_negativo" CHECK ("conta"."limite_negativo" is null or "conta"."limite_negativo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "transacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" text NOT NULL,
	"de_conta" text NOT NULL,
	"para_conta" text NOT NULL,
	"valor" integer NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"operador_id" text NOT NULL,
	"estorno_de" uuid,
	"chave_idempotencia" text NOT NULL,
	CONSTRAINT "transacao_estorno_de_unique" UNIQUE("estorno_de"),
	CONSTRAINT "transacao_chave_idempotencia_unique" UNIQUE("chave_idempotencia"),
	CONSTRAINT "transacao_valor_positivo" CHECK ("transacao"."valor" > 0),
	CONSTRAINT "transacao_contas_distintas" CHECK ("transacao"."de_conta" <> "transacao"."para_conta"),
	CONSTRAINT "transacao_tipo_valido" CHECK ("transacao"."tipo" in ('envio', 'dar', 'tomar', 'deposito_cedula', 'saque_cedula', 'estorno'))
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"telefone" text,
	"papel" text DEFAULT 'usuario' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"termos_aceitos_em" timestamp with time zone,
	"termos_versao" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_papel_valido" CHECK ("user"."papel" in ('usuario', 'caixa', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_ator_id_user_id_fk" FOREIGN KEY ("ator_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_alvo_id_user_id_fk" FOREIGN KEY ("alvo_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta" ADD CONSTRAINT "conta_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacao" ADD CONSTRAINT "transacao_de_conta_conta_usuario_id_fk" FOREIGN KEY ("de_conta") REFERENCES "public"."conta"("usuario_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacao" ADD CONSTRAINT "transacao_para_conta_conta_usuario_id_fk" FOREIGN KEY ("para_conta") REFERENCES "public"."conta"("usuario_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacao" ADD CONSTRAINT "transacao_operador_id_user_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auditoria_alvo_idx" ON "auditoria" USING btree ("alvo_id","criada_em");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transacao_de_idx" ON "transacao" USING btree ("de_conta","criada_em");--> statement-breakpoint
CREATE INDEX "transacao_para_idx" ON "transacao" USING btree ("para_conta","criada_em");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");