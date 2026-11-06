"use server";

import { headers } from "next/headers";
import { exigirSegredo, pedirCodigoDeLogin } from "@/lib/auth";
import { permitir } from "@/lib/limite";

const MENSAGEM = {
  MUITOS_CODIGOS: "Muitos códigos pedidos para este e-mail. Espere alguns minutos.",
  FALHA_ENVIO: "Não conseguimos enviar o e-mail agora. Tente de novo em instantes.",
} as const;

/** Envia o código de login. `erro` vazio = enviado. */
export async function pedirCodigo(emailBruto: string): Promise<{ erro: string }> {
  exigirSegredo();
  const email = String(emailBruto).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erro: "Esse e-mail não parece válido." };
  }

  // Por IP e folgado: no evento, centenas de pessoas saem pelo mesmo Wi-Fi.
  // X-Real-IP é gravado pelo proxy do Railway e não pode ser forjado pelo
  // cliente (ver lib/auth.ts).
  const ip = (await headers()).get("x-real-ip")?.trim() || "desconhecido";
  if (!permitir(`ip:${ip}`, 60, 60 * 1000)) {
    return { erro: "Muitas tentativas. Espere um minuto e tente de novo." };
  }

  const falha = await pedirCodigoDeLogin(email);
  return { erro: falha ? MENSAGEM[falha] : "" };
}
