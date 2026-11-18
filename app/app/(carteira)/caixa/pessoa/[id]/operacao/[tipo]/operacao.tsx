"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { moeda } from "@/lib/formato";
import { Avatar, tamanhoDoNumero } from "../../../../../../pecas";
import { operar, type TipoOperacao } from "../../../../acoes";

const VALOR_ALTO = 1000;

const TEXTOS: Record<
  TipoOperacao,
  { rotulo: string; descricao: string | null; verbo: string; sentido: "para" | "de" }
> = {
  dar: { rotulo: "quanto a pessoa recebe", descricao: "O que ela deixou?", verbo: "Pagar", sentido: "para" },
  tomar: { rotulo: "quanto a pessoa paga", descricao: "O que ela levou?", verbo: "Receber", sentido: "de" },
  deposito_cedula: { rotulo: "valor das cédulas que ela entregou", descricao: null, verbo: "Depositar", sentido: "para" },
  saque_cedula: { rotulo: "valor das cédulas que você entrega", descricao: null, verbo: "Sacar", sentido: "de" },
};

const novaChave = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function Operacao(props: {
  tipo: TipoOperacao;
  alvo: { id: string; nome: string; saldo: number; semLimite: boolean };
  /** Quanto o saldo de caixa ainda pode distribuir. `null` = sem limite (Admin). */
  disponivelDoCaixa: number | null;
}) {
  const router = useRouter();
  const textos = TEXTOS[props.tipo];
  const tira = textos.sentido === "de";

  const [valorTexto, setValorTexto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cienteValorAlto, setCienteValorAlto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const pedido = useRef({ assinatura: "", chave: "" });

  const valor = Number(valorTexto);
  const valorValido = Number.isInteger(valor) && valor >= 1;
  const alemDoLimite = !tira && props.disponivelDoCaixa !== null && valor > props.disponivelDoCaixa;
  // No balcão ninguém fica negativo: a pessoa paga no máximo o que tem.
  const semSaldo = tira && valorValido && !props.alvo.semLimite && valor > props.alvo.saldo;
  const valorAlto = valor > VALOR_ALTO;
  const faltaDescricao = textos.descricao !== null && !descricao.trim();
  const podeEnviar =
    valorValido &&
    !alemDoLimite &&
    !semSaldo &&
    !faltaDescricao &&
    (!valorAlto || cienteValorAlto) &&
    !ocupado;

  function mudarValor(texto: string) {
    setValorTexto(texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9));
    setCienteValorAlto(false);
    setErro("");
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;

    const assinatura = `${valor}|${descricao.trim()}`;
    if (pedido.current.assinatura !== assinatura) pedido.current = { assinatura, chave: novaChave() };

    setOcupado(true);
    setErro("");
    let resposta: Awaited<ReturnType<typeof operar>>;
    try {
      resposta = await operar({
        alvoId: props.alvo.id,
        tipo: props.tipo,
        valor,
        descricao,
        chave: pedido.current.chave,
      });
    } catch {
      setOcupado(false);
      return setErro("Sem resposta do servidor. Confira a conexão e toque de novo: a operação não é feita duas vezes.");
    }
    if (!resposta.ok) {
      setOcupado(false);
      return setErro(resposta.erro);
    }
    router.replace(`/app/caixa/pessoa/${props.alvo.id}?feito=${resposta.transacaoId}`);
    router.refresh();
  }

  return (
    <form className="formulario" style={{ flex: 1 }} onSubmit={confirmar}>
      <div className="destinatario">
        <Avatar id={props.alvo.id} nome={props.alvo.nome} contorno />
        <span className="destinatario-texto">
          <span className="rotulo">{textos.sentido}</span>
          <span className="destinatario-nome">{props.alvo.nome}</span>
        </span>
        <span className="rotulo">saldo {moeda(props.alvo.saldo)}</span>
      </div>

      <div className="nota">
        <div className="nota-faixa guilhoche" aria-hidden="true" />
        <div className="nota-corpo">
          <label className="rotulo" htmlFor="operacao-valor">{textos.rotulo}</label>
          <div className="nota-valor">
            <span className="nota-moeda">D$</span>
            <input
              id="operacao-valor"
              className={tamanhoDoNumero(valorTexto, "nota-entrada")}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              required
              autoFocus
              placeholder="0"
              value={valorTexto}
              onChange={(e) => mudarValor(e.target.value)}
            />
          </div>
          <p className="nota-pe">
            {tira
              ? "entra no saldo do seu caixa"
              : props.disponivelDoCaixa === null
                ? "sai do saldo do seu caixa, sem limite"
                : `sai do saldo do seu caixa · você pode distribuir ${moeda(props.disponivelDoCaixa)}`}
          </p>
        </div>
      </div>

      {textos.descricao && (
        <label className="campo">
          <span>{textos.descricao}</span>
          <input
            maxLength={140}
            required
            placeholder="ex.: bicicleta infantil"
            value={descricao}
            onChange={(e) => {
              setDescricao(e.target.value);
              setErro("");
            }}
          />
        </label>
      )}

      <div className="rodape-acao">
        <p className="mensagem mensagem--erro" role="alert">
          {alemDoLimite && props.disponivelDoCaixa !== null
            ? `O limite do seu caixa não cobre esse valor: você ainda pode distribuir ${moeda(props.disponivelDoCaixa)}.`
            : semSaldo
              ? `${props.alvo.nome} tem ${moeda(props.alvo.saldo)}: não dá para ${props.tipo === "tomar" ? "receber" : "sacar"} mais do que isso.`
              : erro}
        </p>
        {valorAlto && !alemDoLimite && !semSaldo && (
          <label className="aceite">
            <input type="checkbox" checked={cienteValorAlto} onChange={(e) => setCienteValorAlto(e.target.checked)} />
            <span>É um valor alto. Conferi o valor e a pessoa.</span>
          </label>
        )}
        <button className="botao" type="submit" disabled={!podeEnviar}>
          {ocupado ? "Registrando…" : valorValido ? `${textos.verbo} ${moeda(valor)}` : textos.verbo}
        </button>
      </div>
    </form>
  );
}
