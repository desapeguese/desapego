import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const instante = (nome: string) => timestamp(nome, { withTimezone: true });

// ---------------------------------------------------------------------------
// Autenticação. As quatro tabelas abaixo pertencem ao Better Auth: os nomes das
// propriedades em inglês são o contrato dele e não podem ser traduzidos. Os
// campos em português em `user` são nossos (declarados em lib/auth.ts).
// ---------------------------------------------------------------------------

export const PAPEIS = ["usuario", "caixa", "admin"] as const;
export type Papel = (typeof PAPEIS)[number];

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: instante("created_at").notNull().defaultNow(),
    updatedAt: instante("updated_at").notNull().defaultNow(),

    // Do plugin de dois fatores: verdadeiro quando há app autenticador ativo.
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),

    telefone: text("telefone"),
    papel: text("papel", { enum: PAPEIS }).notNull().default("usuario"),
    ativo: boolean("ativo").notNull().default(true),
    // Nulo até a pessoa aceitar termos, LGPD e declarar 18+ no primeiro login.
    termosAceitosEm: instante("termos_aceitos_em"),
    termosVersao: text("termos_versao"),
  },
  (t) => [
    check("user_papel_valido", sql`${t.papel} in ('usuario', 'caixa', 'admin')`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: instante("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: instante("created_at").notNull().defaultNow(),
    updatedAt: instante("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Nosso: esta sessão já provou o segundo fator (entrou com passkey, ou
    // digitou o código do autenticador ou de recuperação). Ver lib/sessao.ts.
    segundoFator: boolean("segundo_fator").notNull().default(false),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instante("access_token_expires_at"),
    refreshTokenExpiresAt: instante("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: instante("created_at").notNull().defaultNow(),
    updatedAt: instante("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instante("expires_at").notNull(),
    createdAt: instante("created_at").notNull().defaultNow(),
    updatedAt: instante("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Passkeys (digital, rosto ou PIN do aparelho). Tabela do plugin de passkey. */
export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: instante("created_at").defaultNow(),
    aaguid: text("aaguid"),
  },
  (t) => [index("passkey_user_idx").on(t.userId), index("passkey_credential_idx").on(t.credentialID)],
);

/** App autenticador (TOTP) e códigos de recuperação. Tabela do plugin de dois fatores. */
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: instante("locked_until"),
  },
  (t) => [index("two_factor_user_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)],
);

// ---------------------------------------------------------------------------
// Moeda
// ---------------------------------------------------------------------------

/**
 * Uma conta por pessoa. `saldo` é um cache: a verdade é a soma das linhas de
 * `transacao`, e os dois só mudam juntos, dentro de lib/ledger.ts.
 */
export const conta = pgTable(
  "conta",
  {
    usuarioId: text("usuario_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "restrict" }),
    // Sequencial, para o número de série da conta (DES-2026-00412).
    numero: integer("numero").generatedAlwaysAsIdentity().notNull().unique(),
    saldo: integer("saldo").notNull().default(0),
    // Quanto a conta pode ficar abaixo de zero. Nulo = padrão do papel
    // (usuário 0, caixa o padrão global, admin sem limite).
    limiteNegativo: integer("limite_negativo"),
    atualizadaEm: instante("atualizada_em").notNull().defaultNow(),
  },
  (t) => [
    check(
      "conta_limite_nao_negativo",
      sql`${t.limiteNegativo} is null or ${t.limiteNegativo} >= 0`,
    ),
  ],
);

export const TIPOS_TRANSACAO = [
  "envio",
  "dar",
  "tomar",
  "deposito_cedula",
  "saque_cedula",
  "estorno",
] as const;
export type TipoTransacao = (typeof TIPOS_TRANSACAO)[number];

/** Imutável: nunca recebe UPDATE nem DELETE. Erros se corrigem com estorno. */
export const transacao = pgTable(
  "transacao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    criadaEm: instante("criada_em").notNull().defaultNow(),
    tipo: text("tipo", { enum: TIPOS_TRANSACAO }).notNull(),
    deConta: text("de_conta")
      .notNull()
      .references(() => conta.usuarioId, { onDelete: "restrict" }),
    paraConta: text("para_conta")
      .notNull()
      .references(() => conta.usuarioId, { onDelete: "restrict" }),
    valor: integer("valor").notNull(),
    descricao: text("descricao").notNull().default(""),
    // Quem apertou o botão. Em envio/dar/tomar é sempre uma das duas pontas.
    operadorId: text("operador_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // Preenchido só em estornos; único, então uma transação é estornada uma vez.
    estornoDe: uuid("estorno_de").unique(),
    // Gerada pelo cliente a cada tentativa: toque duplo ou reenvio por rede
    // ruim não vira duas transações.
    chaveIdempotencia: text("chave_idempotencia").notNull().unique(),
  },
  (t) => [
    check("transacao_valor_positivo", sql`${t.valor} > 0`),
    check("transacao_contas_distintas", sql`${t.deConta} <> ${t.paraConta}`),
    check(
      "transacao_tipo_valido",
      sql`${t.tipo} in ('envio', 'dar', 'tomar', 'deposito_cedula', 'saque_cedula', 'estorno')`,
    ),
    index("transacao_de_idx").on(t.deConta, t.criadaEm),
    index("transacao_para_idx").on(t.paraConta, t.criadaEm),
  ],
);

/** Ajustes globais definidos pelo Admin. Ausente = padrão do código. */
export const configuracao = pgTable("configuracao", {
  chave: text("chave").primaryKey(),
  valor: integer("valor").notNull(),
});

export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    criadaEm: instante("criada_em").notNull().defaultNow(),
    // Nulo quando a ação é do próprio sistema.
    atorId: text("ator_id").references(() => user.id, { onDelete: "restrict" }),
    alvoId: text("alvo_id").references(() => user.id, { onDelete: "restrict" }),
    acao: text("acao").notNull(),
    detalhes: jsonb("detalhes").notNull().default({}),
  },
  (t) => [index("auditoria_alvo_idx").on(t.alvoId, t.criadaEm)],
);

/**
 * Edições do Festival. Servem para registro e para filtrar relatórios: uma
 * transação pertence à edição em cujo intervalo de dias ela caiu (horário de
 * Brasília). Nada é gravado na transação, então corrigir as datas de uma
 * edição reclassifica o histórico sem tocar no livro, que é imutável.
 */
export const edicao = pgTable(
  "edicao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    // Dias inteiros, inclusivos nas duas pontas.
    inicio: date("inicio", { mode: "string" }).notNull(),
    fim: date("fim", { mode: "string" }).notNull(),
    criadaEm: instante("criada_em").notNull().defaultNow(),
  },
  (t) => [check("edicao_datas_em_ordem", sql`${t.inicio} <= ${t.fim}`)],
);
