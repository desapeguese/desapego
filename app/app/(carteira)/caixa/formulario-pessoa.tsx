"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EstadoPessoa } from "./acoes";

export function FormularioPessoa(props: {
  acao: (anterior: EstadoPessoa, dados: FormData) => Promise<EstadoPessoa>;
  inicial: { nome: string; email: string; telefone: string };
  /** Na edição, o id de quem está sendo editado. */
  id?: string;
  botao: string;
  /** Aviso mostrado quando o e-mail for diferente do atual. */
  avisoEmail?: string;
}) {
  const [estado, acao, enviando] = useActionState(props.acao, { erro: "", ...props.inicial });

  return (
    <form className="formulario" action={acao}>
      {props.id && <input type="hidden" name="id" value={props.id} />}
      <label className="campo">
        <span>Nome completo</span>
        <input name="nome" autoComplete="off" required maxLength={120} defaultValue={estado.nome} />
      </label>
      <label className="campo">
        <span>E-mail</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={estado.email}
        />
      </label>
      {props.avisoEmail && <p className="mensagem">{props.avisoEmail}</p>}
      <label className="campo">
        <span>Telefone com DDD (opcional)</span>
        <input name="telefone" type="tel" inputMode="tel" autoComplete="off" placeholder="(11) 91234-5678" defaultValue={estado.telefone} />
      </label>

      <p className="mensagem mensagem--erro" role="alert">
        {estado.erro}
        {estado.existenteId && (
          <>
            {" "}
            <Link href={`/app/caixa/pessoa/${estado.existenteId}`}>Abrir a conta que já existe</Link>
          </>
        )}
      </p>
      <button className="botao" type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : props.botao}
      </button>
    </form>
  );
}
