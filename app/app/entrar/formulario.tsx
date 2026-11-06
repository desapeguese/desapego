"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { pedirCodigo } from "./acoes";

type Erro = { code?: string; status?: number; message?: string } | null;

function traduzir(erro: Erro): string {
  if (!erro) return "";
  if (erro.status === 429) return "Muitas tentativas. Espere um minuto e tente de novo.";
  switch (erro.code) {
    case "INVALID_OTP":
      return "Código incorreto. Confira e tente de novo.";
    case "OTP_EXPIRED":
      return "Esse código expirou. Peça um novo.";
    case "TOO_MANY_ATTEMPTS":
      return "Muitas tentativas com esse código. Peça um novo.";
    case "INVALID_EMAIL":
      return "Esse e-mail não parece válido.";
    case "CONTA_DESATIVADA":
      return "Esta conta está desativada. Procure o Caixa.";
    default:
      return "Não deu certo agora. Tente de novo em instantes.";
  }
}

export function FormularioEntrar({ googleAtivo }: { googleAtivo: boolean }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  async function solicitar() {
    setOcupado(true);
    setErro("");
    setAviso("");
    const { erro: falha } = await pedirCodigo(email);
    setOcupado(false);
    if (falha) {
      setErro(falha);
      return false;
    }
    return true;
  }

  async function enviarEmail(e: FormEvent) {
    e.preventDefault();
    if (await solicitar()) {
      setCodigo("");
      setEtapa("codigo");
    }
  }

  async function reenviar() {
    if (await solicitar()) setAviso("Enviamos um código novo.");
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro("");
    setAviso("");
    const { error } = await authClient.signIn.emailOtp({
      email: email.trim().toLowerCase(),
      otp: codigo,
    });
    if (error) {
      setOcupado(false);
      setErro(traduzir(error));
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  async function entrarComGoogle() {
    setOcupado(true);
    setErro("");
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/app" });
    if (error) {
      setOcupado(false);
      setErro(traduzir(error));
    }
  }

  if (etapa === "codigo") {
    return (
      <form className="cartao formulario" onSubmit={entrar}>
        <p className="formulario-texto">
          Enviamos um código de 6 dígitos para <strong>{email.trim().toLowerCase()}</strong>.
          Ele vale por 10 minutos.
        </p>
        <label className="campo">
          <span>Código</span>
          <input
            className="campo-codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <p className="mensagem mensagem--erro" role="alert">{erro}</p>
        <p className="mensagem" role="status">{aviso}</p>
        <button className="botao" type="submit" disabled={ocupado || codigo.length !== 6}>
          {ocupado ? "Aguarde…" : "Entrar"}
        </button>
        <div className="formulario-links">
          <button type="button" className="link" onClick={reenviar} disabled={ocupado}>
            Reenviar código
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setEtapa("email");
              setErro("");
              setAviso("");
            }}
            disabled={ocupado}
          >
            Usar outro e-mail
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="cartao formulario" onSubmit={enviarEmail}>
      <label className="campo">
        <span>Seu e-mail</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <p className="mensagem mensagem--erro" role="alert">{erro}</p>
      <button className="botao" type="submit" disabled={ocupado}>
        {ocupado ? "Enviando…" : "Receber código"}
      </button>
      {googleAtivo && (
        <>
          <p className="divisor">ou</p>
          <button
            className="botao botao--contorno"
            type="button"
            onClick={entrarComGoogle}
            disabled={ocupado}
          >
            Entrar com Google
          </button>
        </>
      )}
    </form>
  );
}
