"use client";

import { useEffect, useRef, useState } from "react";

/** Tira o código da conta de um QR da Desapego (um link …/app/enviar?para=…). */
export function codigoDoQr(texto: string): string | null {
  try {
    const url = new URL(texto);
    if (!url.pathname.replace(/\/$/, "").endsWith("/app/enviar")) return null;
    return url.searchParams.get("para");
  } catch {
    return null;
  }
}

/**
 * Câmera traseira + leitura de QR. Usa jsQR em vez do BarcodeDetector do
 * navegador porque o Safari do iPhone não tem o segundo.
 */
export function LeitorQr({ aoLer }: { aoLer: (codigo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<"abrindo" | "lendo" | "negada" | "indisponivel">("abrindo");
  const [aviso, setAviso] = useState("");
  // Sempre a versão mais nova do callback, sem reiniciar a câmera a cada render.
  const aoLerAtual = useRef(aoLer);
  aoLerAtual.current = aoLer;

  useEffect(() => {
    let ativo = true;
    let quadro = 0;
    let fluxo: MediaStream | null = null;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setEstado("indisponivel");
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (erro) {
        if (!ativo) return;
        const nome = (erro as DOMException)?.name;
        return setEstado(nome === "NotAllowedError" || nome === "SecurityError" ? "negada" : "indisponivel");
      }
      const elemento = video.current;
      if (!ativo || !elemento) return fluxo.getTracks().forEach((t) => t.stop());

      const { default: jsQR } = await import("jsqr");
      elemento.srcObject = fluxo;
      await elemento.play().catch(() => {});
      if (!ativo) return;
      setEstado("lendo");

      const tela = document.createElement("canvas");
      const contexto = tela.getContext("2d", { willReadFrequently: true });
      let ultimaLeitura = 0;

      const ler = (agora: number) => {
        if (!ativo) return;
        quadro = requestAnimationFrame(ler);
        // ~8 leituras por segundo bastam e poupam bateria.
        if (agora - ultimaLeitura < 120 || !contexto || elemento.readyState < 2) return;
        ultimaLeitura = agora;

        // Reduzido a 480 px no maior lado: decodifica rápido e ainda lê bem.
        const escala = Math.min(1, 480 / Math.max(elemento.videoWidth, elemento.videoHeight));
        tela.width = Math.round(elemento.videoWidth * escala);
        tela.height = Math.round(elemento.videoHeight * escala);
        if (!tela.width || !tela.height) return;
        contexto.drawImage(elemento, 0, 0, tela.width, tela.height);
        const imagem = contexto.getImageData(0, 0, tela.width, tela.height);
        const lido = jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: "dontInvert" });
        if (!lido?.data) return;

        const codigo = codigoDoQr(lido.data);
        if (codigo) {
          ativo = false;
          aoLerAtual.current(codigo);
        } else {
          setAviso("Esse QR não é de uma carteira Desapego.");
        }
      };
      quadro = requestAnimationFrame(ler);
    })();

    return () => {
      ativo = false;
      cancelAnimationFrame(quadro);
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (estado === "negada" || estado === "indisponivel") {
    return (
      <p className="leitor-recado">
        {estado === "negada"
          ? "A câmera está bloqueada para este site. Libere nas permissões do navegador ou envie pelo e-mail abaixo."
          : "Não foi possível abrir a câmera neste aparelho. Envie pelo e-mail abaixo."}
      </p>
    );
  }

  return (
    <div className="leitor">
      <video ref={video} className="leitor-video" playsInline muted aria-label="Câmera para ler o QR code" />
      <div className="leitor-mira" aria-hidden="true" />
      <p className="leitor-legenda" role="status">
        {estado === "abrindo" ? "Abrindo a câmera…" : aviso || "Aponte para o QR code de quem vai receber"}
      </p>
    </div>
  );
}
