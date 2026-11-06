import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { count, eq } from "drizzle-orm";
import { cadastroAberto, ehAdminInicial } from "./cadastro";
import { db, schema } from "./db";
import { enviarEmail } from "./email";
import { permitir } from "./limite";

const DIA = 60 * 60 * 24;
const MINUTOS_CODIGO = 10;

export type FalhaCodigo = "MUITOS_CODIGOS" | "FALHA_ENVIO" | "CADASTRO_FECHADO";

/**
 * O Better Auth engole qualquer erro de `sendVerificationOTP` e responde
 * sucesso, e a pessoa ficaria esperando um e-mail que não saiu. Quem pede o
 * código por `pedirCodigoDeLogin` abre este contexto, e o callback anota nele
 * o que deu errado.
 */
const pedidoDeCodigo = new AsyncLocalStorage<{ falha?: FalhaCodigo }>();

export async function pedirCodigoDeLogin(email: string): Promise<FalhaCodigo | null> {
  const pedido: { falha?: FalhaCodigo } = {};
  await pedidoDeCodigo.run(pedido, () =>
    auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } }),
  );
  return pedido.falha ?? null;
}

export const googleAtivo = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

/**
 * Sem BETTER_AUTH_SECRET o Better Auth cai num segredo padrão e público, com o
 * qual qualquer um forjaria sessões. O build roda sem variáveis, então a
 * checagem é feita a cada pedido (rota de auth e leitura de sessão), não aqui
 * no carregamento do módulo.
 */
export function exigirSegredo() {
  if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET não configurado: login desligado.");
  }
}

/**
 * Segundo fator (seção 4.1 do PRD).
 *
 * Quem tem passkey ou app autenticador "tem 2FA". Cada sessão guarda se já
 * provou o segundo fator (`session.segundoFator`): entrar com passkey prova na
 * hora; entrar com código de e-mail ou Google deixa a sessão pendente, e
 * lib/sessao.ts manda a pessoa para /app/verificar.
 */
export async function tem2FA(usuarioId: string, twoFactorEnabled: boolean | null | undefined): Promise<boolean> {
  if (twoFactorEnabled) return true;
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.passkey)
    .where(eq(schema.passkey.userId, usuarioId));
  return total > 0;
}

/** Rotas que provam o segundo fator quando terminam bem. */
const PROVAM_O_FATOR = new Set([
  "/passkey/verify-authentication",
  "/passkey/verify-registration",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);
/** Rotas de quem ainda está provando: não podem exigir o que elas mesmas concedem. */
const LIVRES = new Set([
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
]);

const marcarSessao = (sessaoId: string) =>
  db.update(schema.session).set({ segundoFator: true }).where(eq(schema.session.id, sessaoId));

const enderecoPublico = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : null;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),

  session: {
    expiresIn: 90 * DIA,
    updateAge: DIA,
    additionalFields: {
      segundoFator: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },

  hooks: {
    // Quem já tem 2FA e está numa sessão que ainda não o provou não pode
    // mexer nos próprios fatores (cadastrar outra passkey, desligar o
    // autenticador...). Sem isto, bastaria o e-mail da vítima para trocar o
    // segundo fator dela pela API, sem passar pelas telas.
    before: createAuthMiddleware(async (ctx) => {
      const caminho = ctx.path ?? "";
      if (!(caminho.startsWith("/passkey/") || caminho.startsWith("/two-factor/")) || LIVRES.has(caminho)) return;
      const atual = await getSessionFromCtx(ctx);
      if (!atual) return;
      const sessao = atual.session as typeof atual.session & { segundoFator?: boolean };
      const pessoa = atual.user as typeof atual.user & { twoFactorEnabled?: boolean };
      if (!sessao.segundoFator && (await tem2FA(pessoa.id, pessoa.twoFactorEnabled))) {
        throw new APIError("FORBIDDEN", {
          code: "SEGUNDO_FATOR_PENDENTE",
          message: "Confirme sua identidade antes de mudar a proteção da conta.",
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const caminho = ctx.path ?? "";
      if (!PROVAM_O_FATOR.has(caminho)) return;
      const devolvido = ctx.context.returned;
      if (devolvido instanceof Error) return;
      // O login com passkey cria a sessão na própria rota; as outras rotas
      // provam o fator para a sessão que já existia.
      const sessaoId = ctx.context.newSession?.session.id ?? (await getSessionFromCtx(ctx))?.session.id;
      if (sessaoId) await marcarSessao(sessaoId);
    }),
  },

  // O proxy do Railway grava o IP do visitante em X-Real-IP, sobrescrevendo o
  // que o cliente mandar. O X-Forwarded-For chega com vários endereços e o
  // Better Auth o ignora; sem isto, o limite de tentativas trata todos os
  // visitantes como um só.
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip"] } },

  user: {
    // `input: false`: nenhum destes campos pode ser definido pelo cliente no
    // cadastro. Mudam só por código do servidor.
    additionalFields: {
      telefone: { type: "string", required: false, input: false },
      papel: { type: "string", required: false, defaultValue: "usuario", input: false },
      ativo: { type: "boolean", required: false, defaultValue: true, input: false },
      termosAceitosEm: { type: "date", required: false, input: false },
      termosVersao: { type: "string", required: false, input: false },
    },
  },

  // Código por e-mail e Google caem na mesma conta quando o e-mail é o mesmo.
  account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },

  // Com o cadastro fechado o Google também fica de fora: ele criaria contas.
  socialProviders: googleAtivo && cadastroAberto
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  databaseHooks: {
    user: {
      create: {
        before: async (novo) => ({
          data: { ...novo, papel: ehAdminInicial(novo.email) ? "admin" : "usuario" },
        }),
        after: async (criado) => {
          await db.insert(schema.conta).values({ usuarioId: criado.id }).onConflictDoNothing();
        },
      },
    },
    session: {
      create: {
        before: async (sessao) => {
          const [pessoa] = await db
            .select({ ativo: schema.user.ativo })
            .from(schema.user)
            .where(eq(schema.user.id, sessao.userId));
          if (pessoa && !pessoa.ativo) {
            throw new APIError("FORBIDDEN", {
              code: "CONTA_DESATIVADA",
              message: "Esta conta está desativada. Procure o Caixa.",
            });
          }
        },
      },
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      // Estes limites são por IP, e no evento centenas de pessoas saem pelo
      // mesmo Wi-Fi: precisam ser folgados. O abuso de envio de e-mail é
      // contido pelo limite por endereço, dentro de `sendVerificationOTP`.
      "/email-otp/send-verification-otp": { window: 60, max: 60 },
      "/sign-in/email-otp": { window: 60, max: 120 },
      // O padrão do Better Auth aqui é 3 pedidos a cada 10 s por IP, pouco
      // para um evento inteiro atrás do mesmo Wi-Fi. Quem segura a força
      // bruta no código do autenticador é o bloqueio por conta do próprio
      // plugin (tentativas erradas seguidas travam a verificação).
      "/two-factor/verify-totp": { window: 60, max: 60 },
      "/two-factor/verify-backup-code": { window: 60, max: 30 },
      "/two-factor/enable": { window: 60, max: 30 },
      "/passkey/generate-authenticate-options": { window: 60, max: 120 },
      "/passkey/verify-authentication": { window: 60, max: 120 },
      "/passkey/generate-register-options": { window: 60, max: 60 },
      "/passkey/verify-registration": { window: 60, max: 60 },
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: MINUTOS_CODIGO * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp }) {
        const pedido = pedidoDeCodigo.getStore();
        // Aqui dentro para valer também para quem chamar a rota HTTP direto.
        if (!cadastroAberto && !ehAdminInicial(email)) {
          if (pedido) pedido.falha = "CADASTRO_FECHADO";
          return;
        }
        // Por endereço, e aqui dentro para valer também para quem chamar a
        // rota HTTP direto: no máximo 4 códigos a cada 10 minutos.
        if (!permitir(`codigo:${email}`, 4, 10 * 60 * 1000)) {
          if (pedido) pedido.falha = "MUITOS_CODIGOS";
          return;
        }
        try {
          await enviarEmail({
            para: email,
            assunto: `${otp} é o seu código da Moeda Desapego`,
            texto:
              `Seu código para entrar na Moeda Desapego é:\n\n${otp}\n\n` +
              `Ele vale por ${MINUTOS_CODIGO} minutos e só pode ser usado uma vez.\n` +
              `Se não foi você quem pediu, ignore este e-mail.`,
          });
        } catch (erro) {
          if (pedido) pedido.falha = "FALHA_ENVIO";
          throw erro;
        }
      },
    }),
    passkey({
      rpName: "Moeda Desapego",
      // A passkey fica presa ao domínio: vale no navegador e no app instalado.
      rpID: enderecoPublico?.hostname ?? "localhost",
      origin: enderecoPublico?.origin ?? null,
    }),
    // Sem senha no app: ativar e desativar o autenticador não pede senha. Quem
    // protege essas rotas é o `hooks.before` acima.
    twoFactor({ issuer: "Moeda Desapego", allowPasswordless: true }),
    // Precisa ser o último: grava os cookies de sessão em server actions.
    nextCookies(),
  ],
});

export { cadastroAberto, ehAdminInicial };
