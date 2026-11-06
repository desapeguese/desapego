"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await authClient.signOut();
    router.replace("/app/entrar");
    router.refresh();
  }

  return (
    <button type="button" className="botao botao--contorno" onClick={sair} disabled={saindo}>
      {saindo ? "Saindo…" : "Sair da conta"}
    </button>
  );
}
