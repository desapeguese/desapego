CREATE TABLE "edicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edicao_datas_em_ordem" CHECK ("edicao"."inicio" <= "edicao"."fim")
);
