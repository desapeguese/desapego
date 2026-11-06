import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
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

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),

  session: { expiresIn: 90 * DIA, updateAge: DIA },

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
    // Precisa ser o último: grava os cookies de sessão em server actions.
    nextCookies(),
  ],
});

export { cadastroAberto, ehAdminInicial };
