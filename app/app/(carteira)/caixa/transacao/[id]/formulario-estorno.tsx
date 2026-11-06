"use client";

import { useActionState, useState } from "react";
import { estornarTransacao } from "../../acoes";

export function FormularioEstorno({ id }: { id: string }) {
  const [estado, acao, enviando] = useActionState(estornarTransacao, { erro: "", motivo: "" });
  // Uma chave por abertura da tela: reenviar o mesmo estorno não cria dois.
  const [chave] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
  );

  return (
    <form className="formulario cartao" action={acao}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="chave" value={chave} />
      <label className="campo">
        <span>Motivo do estorno</span>
        <input name="motivo" required maxLength={140} placeholder="ex.: valor digitado errado" defaultValue={estado.motivo} />
      </label>
      <p className="mensagem">
        O estorno cria a transação inversa, mesmo que a pessoa fique com saldo negativo. Não dá para desfazer.
      </p>
      <p className="mensagem mensagem--erro" role="alert">{estado.erro}</p>
      <button className="botao botao--contorno" type="submit" disabled={enviando}>
        {enviando ? "Estornando…" : "Estornar esta transação"}
      </button>
    </form>
  );
}
