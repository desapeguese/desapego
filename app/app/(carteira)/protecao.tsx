import Link from "next/link";
import { moeda, SALDO_QUE_EXIGE_2FA } from "@/lib/formato";

/** O lembrete (ou a trava) de segundo fator para quem tem saldo alto. */
export function AvisoProtecao({ bloqueia = false }: { bloqueia?: boolean }) {
  return (
    <aside className="cartao protecao" aria-label="Proteção da conta">
      <p className="instalar-titulo">
        {bloqueia ? "Proteja sua conta para enviar" : "Proteja sua conta"}
      </p>
      <p className="instalar-texto">
        Seu saldo passou de {moeda(SALDO_QUE_EXIGE_2FA)}. Para enviar, ative a entrada com digital ou rosto. Leva
        menos de um minuto, e você continua recebendo normalmente.
      </p>
      <Link className="botao" href="/app/conta#seguranca">Ativar proteção</Link>
    </aside>
  );
}
