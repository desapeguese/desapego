import { toNextJsHandler } from "better-auth/next-js";
import { auth, exigirSegredo } from "@/lib/auth";

const rotas = toNextJsHandler(auth);

export async function GET(pedido: Request) {
  exigirSegredo();
  return rotas.GET(pedido);
}

export async function POST(pedido: Request) {
  exigirSegredo();
  return rotas.POST(pedido);
}
