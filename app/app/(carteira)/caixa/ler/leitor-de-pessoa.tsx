"use client";

import { useRouter } from "next/navigation";
import { LeitorQr } from "../../enviar/leitor";

/** O mesmo leitor do envio; aqui o QR abre a ficha da pessoa no Caixa. */
export function LeitorDePessoa() {
  const router = useRouter();
  return <LeitorQr aoLer={(codigo) => router.push(`/app/caixa/pessoa/${encodeURIComponent(codigo)}`)} />;
}
