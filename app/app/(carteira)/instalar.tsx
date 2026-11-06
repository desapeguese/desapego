"use client";

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<unknown> };
const CHAVE = "desapego:instalar-dispensado";

/**
 * Convite para pôr o app na tela inicial. No Android o navegador oferece um
 * botão de instalar; no iPhone só existe o caminho manual pelo menu
 * Compartilhar; dentro do Instagram/Facebook não dá, e o jeito é abrir no
 * navegador de verdade.
 */
export function Instalar() {
  const [modo, setModo] = useState<"nada" | "botao" | "ios" | "embutido">("nada");
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    const instalado =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dispensado = false;
    try {
      dispensado = localStorage.getItem(CHAVE) === "1";
    } catch {
      // Navegação privada: segue sem lembrar.
    }
    if (instalado || dispensado) return;

    const agente = navigator.userAgent;
    if (/Instagram|FBAN|FBAV|FB_IAB/.test(agente)) setModo("embutido");
    else if (/iPhone|iPad|iPod/.test(agente)) setModo("ios");

    const aoOferecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setModo("botao");
    };
    const aoInstalar = () => setModo("nada");
    window.addEventListener("beforeinstallprompt", aoOferecer);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoOferecer);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (modo === "nada") return null;

  function dispensar() {
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {
      // Sem armazenamento: some só até a próxima visita.
    }
    setModo("nada");
  }

  return (
    <aside className="cartao instalar" aria-label="Instalar o app">
      <p className="instalar-titulo">Tenha a carteira na tela inicial</p>
      {modo === "botao" && (
        <button
          className="botao botao--contorno"
          type="button"
          onClick={async () => {
            await evento?.prompt();
            setModo("nada");
          }}
        >
          Instalar app
        </button>
      )}
      {modo === "ios" && (
        <p className="instalar-texto">
          No Safari, toque em <strong>Compartilhar</strong> e depois em{" "}
          <strong>Adicionar à Tela de Início</strong>.
        </p>
      )}
      {modo === "embutido" && (
        <p className="instalar-texto">
          Você está no navegador do Instagram ou Facebook. Toque no menu{" "}
          <strong>⋯</strong> e escolha <strong>Abrir no navegador</strong> para instalar.
        </p>
      )}
      <button type="button" className="link" onClick={dispensar}>
        Agora não
      </button>
    </aside>
  );
}
