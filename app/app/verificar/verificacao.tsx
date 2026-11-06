"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function Verificacao({ autenticadorAtivo, email }: { autenticadorAtivo: boolean; email: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [codigo, setCodigo] = useState("");
  const [usarRecuperacao, setUsarRecuperacao] = useState(false);

  const seguir = () => {
    router.replace("/app");
    router.refresh();
  };

  async function comPasskey() {
    setOcupado(true);
    setErro("");
    const resposta = await authClient.signIn.passkey();
    if (resposta?.error) {
      setOcupado(false);
      const cancelou = /cancel|abort|NotAllowed/i.test(JSON.stringify(resposta.error));
      return setErro(cancelou ? "" : "Este aparelho não tem uma passkey desta conta. Use outro jeito abaixo.");
    }
    seguir();
  }

  async function comCodigo(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro("");
    const { error } = usarRecuperacao
      ? await authClient.twoFactor.verifyBackupCode({ code: codigo.trim() })
      : await authClient.twoFactor.verifyTotp({ code: codigo.trim() });
    if (error) {
      setOcupado(false);
      return setErro(
        error.status === 429 || /lock/i.test(String(error.code))
          ? "Muitas tentativas erradas. Espere alguns minutos."
          : "Código incorreto. Confira e tente de novo.",
      );
    }
    seguir();
  }

  async function sair() {
    setOcupado(true);
    await authClient.signOut();
    router.replace("/app/entrar");
    router.refresh();
  }

  return (
    <div className="formulario">
      <p className="mensagem mensagem--erro" role="alert">{erro}</p>

      <button type="button" className="botao" disabled={ocupado} onClick={comPasskey}>
        Usar digital, rosto ou PIN
      </button>

      {autenticadorAtivo && (
        <>
          <p className="divisor">ou</p>
          <form className="formulario" onSubmit={comCodigo}>
            <label className="campo">
              <span>{usarRecuperacao ? "Código de recuperação" : "Código do app autenticador"}</span>
              <input
                className={usarRecuperacao ? undefined : "campo-codigo"}
                inputMode={usarRecuperacao ? "text" : "numeric"}
                autoComplete="one-time-code"
                autoCapitalize="none"
                required
                value={codigo}
                onChange={(e) => setCodigo(usarRecuperacao ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            <button type="submit" className="botao botao--contorno" disabled={ocupado || codigo.trim().length < 6}>
              Confirmar
            </button>
            <button
              type="button"
              className="link"
              disabled={ocupado}
              onClick={() => {
                setUsarRecuperacao(!usarRecuperacao);
                setCodigo("");
                setErro("");
              }}
            >
              {usarRecuperacao ? "Usar o código do app autenticador" : "Perdi o acesso ao app: usar código de recuperação"}
            </button>
          </form>
        </>
      )}

      <p className="app-aviso">
        Perdeu o aparelho e não tem outro jeito? Procure a administração do Festival para liberar a conta {email}.
      </p>
      <button type="button" className="link" disabled={ocupado} onClick={sair}>
        Sair e entrar com outra conta
      </button>
    </div>
  );
}
