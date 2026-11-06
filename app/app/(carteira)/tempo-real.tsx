"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { moeda } from "@/lib/formato";

type Aviso = { tipo: "recebido" | "debitado"; transacaoId: string; valor: number; de: string };

/**
 * Mantém a carteira em dia sem recarregar: escuta /api/eventos e, ao receber,
 * mostra o aviso e pede ao servidor os dados novos. Se a conexão em tempo real
 * cair, consulta o servidor de tempos em tempos e ao voltar para o app.
 */
export function TempoReal() {
  const router = useRouter();
  const [recebido, setRecebido] = useState<Aviso | null>(null);
  const [semConexao, setSemConexao] = useState(false);

  useEffect(() => {
    const fonte = new EventSource("/api/eventos");
    const aoAvisar = (evento: Event) => {
      setRecebido(JSON.parse((evento as MessageEvent).data));
      router.refresh();
    };
    fonte.addEventListener("recebido", aoAvisar);
    fonte.addEventListener("debitado", aoAvisar);

    const reserva = setInterval(() => {
      if (fonte.readyState !== EventSource.OPEN && document.visibilityState === "visible") {
        router.refresh();
      }
    }, 20_000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const conexao = () => setSemConexao(!navigator.onLine);

    conexao();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", conexao);
    window.addEventListener("offline", conexao);
    return () => {
      fonte.close();
      clearInterval(reserva);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", conexao);
      window.removeEventListener("offline", conexao);
    };
  }, [router]);

  return (
    <div className="avisos" aria-live="assertive">
      {semConexao && <p className="aviso-flutuante aviso-flutuante--alerta">Sem conexão com a internet</p>}
      {recebido && (
        <div className="aviso-flutuante">
          <Link href={`/app/transacao/${recebido.transacaoId}`} onClick={() => setRecebido(null)}>
            <strong>
              {recebido.tipo === "recebido" ? "Você recebeu" : "Saíram"} {moeda(recebido.valor)}
            </strong>
            <span>{recebido.tipo === "recebido" ? `de ${recebido.de}` : `por ${recebido.de}`}</span>
          </Link>
          <button type="button" aria-label="Fechar aviso" onClick={() => setRecebido(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
