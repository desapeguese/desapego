"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completarCadastro } from "./acoes";

export function FormularioCadastro(props: { nome: string; telefone: string; email: string }) {
  const [estado, acao, enviando] = useActionState(completarCadastro, {
    erro: "",
    nome: props.nome,
    telefone: props.telefone,
  });

  return (
    <form className="formulario" action={acao}>
      <label className="campo">
        <span>Nome completo</span>
        <input name="nome" autoComplete="name" required maxLength={120} defaultValue={estado.nome} />
      </label>
      <label className="campo">
        <span>E-mail</span>
        <input value={props.email} readOnly disabled />
      </label>
      <label className="campo">
        <span>Telefone com DDD (opcional)</span>
        <input
          name="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          defaultValue={estado.telefone}
        />
      </label>

      <label className="aceite">
        <input type="checkbox" name="maior" required />
        <span>Declaro que tenho 18 anos ou mais.</span>
      </label>
      <label className="aceite">
        <input type="checkbox" name="termos" required />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank">
            termos de uso e a política de privacidade
          </Link>
          , e autorizo o uso dos meus dados para o funcionamento da Moeda Desapego.
        </span>
      </label>

      <p className="mensagem mensagem--erro" role="alert">{estado.erro}</p>
      <button className="botao" type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Criar minha carteira"}
      </button>
    </form>
  );
}
