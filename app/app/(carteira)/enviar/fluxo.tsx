"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { moeda } from "@/lib/formato";
import { Avatar, tamanhoDoNumero } from "../../pecas";
import { buscarDestinatario, enviar, type Destinatario } from "./acoes";
import { LeitorQr } from "./leitor";

const VALOR_ALTO = 1000;
const novaChave = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function FluxoEnviar(props: {
  saldo: number;
  /** Quanto dá para enviar. `null` = sem limite (Admin). */
  disponivel: number | null;
  destinatarioInicial: Destinatario | null;
  erroInicial: string;
}) {
  const router = useRouter();
  const [destinatario, setDestinatario] = useState(props.destinatarioInicial);
  const [email, setEmail] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cienteValorAlto, setCienteValorAlto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(props.erroInicial);
  // Uma chave por pedido: se a rede cair e a pessoa tocar de novo no mesmo
  // envio, o servidor reconhece e não envia duas vezes. Mudou destinatário,
  // valor ou descrição, é outro pedido e a chave é outra.
  const pedido = useRef({ assinatura: "", chave: "" });

  const valor = Number(valorTexto);
  const valorValido = Number.isInteger(valor) && valor >= 1;
  const acimaDoSaldo = props.disponivel !== null && valor > props.disponivel;
  const valorAlto = valor > VALOR_ALTO;
  const podeEnviar = valorValido && !acimaDoSaldo && (!valorAlto || cienteValorAlto) && !ocupado;

  function mudarValor(texto: string) {
    setValorTexto(texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9));
    setCienteValorAlto(false);
    setErro("");
  }

  async function escolher(entrada: { para?: string; email?: string }) {
    setOcupado(true);
    setErro("");
    const resposta = await buscarDestinatario(entrada);
    setOcupado(false);
    if (!resposta.ok) return setErro(resposta.erro);
    setDestinatario(resposta.destinatario);
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!destinatario || !podeEnviar) return;

    const assinatura = `${destinatario.id}|${valor}|${descricao.trim()}`;
    if (pedido.current.assinatura !== assinatura) pedido.current = { assinatura, chave: novaChave() };

    setOcupado(true);
    setErro("");
    let resposta: Awaited<ReturnType<typeof enviar>>;
    try {
      resposta = await enviar({ paraId: destinatario.id, valor, descricao, chave: pedido.current.chave });
    } catch {
      setOcupado(false);
      return setErro("Sem resposta do servidor. Confira sua conexão e toque em enviar de novo.");
    }
    if (!resposta.ok) {
      setOcupado(false);
      // O saldo passou do limite com a tela aberta: recarregar mostra o aviso.
      if (resposta.erro === "PROTECAO_NECESSARIA") return router.refresh();
      return setErro(resposta.erro);
    }
    router.replace(`/app/transacao/${resposta.transacaoId}?enviada=1`);
    router.refresh();
  }

  if (!destinatario) {
    return (
      <>
        <LeitorQr aoLer={(para) => escolher({ para })} />
        <p className="mensagem mensagem--erro" role="alert">{erro}</p>
        <form
          className="formulario"
          onSubmit={(e) => {
            e.preventDefault();
            escolher({ email });
          }}
        >
          <label className="campo">
            <span>Ou o e-mail de quem recebe</span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              placeholder="pessoa@exemplo.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="botao botao--contorno" type="submit" disabled={ocupado}>
            {ocupado ? "Buscando…" : "Continuar"}
          </button>
        </form>
      </>
    );
  }

  return (
    <form className="formulario" style={{ flex: 1 }} onSubmit={confirmar}>
      <div className="destinatario">
        <Avatar id={destinatario.id} nome={destinatario.nome} contorno />
        <span className="destinatario-texto">
          <span className="rotulo">para</span>
          <span className="destinatario-nome">{destinatario.nome}</span>
        </span>
        <button
          type="button"
          className="link"
          disabled={ocupado}
          onClick={() => {
            setErro("");
            setDestinatario(null);
          }}
        >
          Trocar
        </button>
      </div>

      <div className="nota">
        <div className="nota-faixa guilhoche" aria-hidden="true" />
        <div className="nota-corpo">
          <label className="rotulo" htmlFor="enviar-valor">quanto você envia</label>
          <div className="nota-valor">
            <span className="nota-moeda">D$</span>
            <input
              id="enviar-valor"
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
            <span className="dica-valor">toque no número para digitar</span>
            {props.disponivel === null ? "sem limite" : `disponível: ${moeda(props.disponivel)}`}
          </p>
        </div>
      </div>

      <label className="campo">
        <span>Pelo quê? (opcional)</span>
        <input maxLength={140} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>

      <div className="rodape-acao">
        {acimaDoSaldo && props.disponivel !== null ? (
          <p className="mensagem mensagem--erro" role="alert">
            Saldo insuficiente: você pode enviar até {moeda(props.disponivel)}.
          </p>
        ) : (
          <p className="mensagem mensagem--erro" role="alert">{erro}</p>
        )}
        {valorAlto && !acimaDoSaldo && (
          <label className="aceite">
            <input
              type="checkbox"
              checked={cienteValorAlto}
              onChange={(e) => setCienteValorAlto(e.target.checked)}
            />
            <span>É um valor alto. Conferi o valor e o destinatário.</span>
          </label>
        )}
        {valorValido && !acimaDoSaldo && (
          <p className="app-aviso">Depois do envio seu saldo fica em {moeda(props.saldo - valor)}.</p>
        )}
        <button className="botao" type="submit" disabled={!podeEnviar}>
          {ocupado ? "Enviando…" : valorValido ? `Enviar ${moeda(valor)}` : "Enviar"}
          {!ocupado && (
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
