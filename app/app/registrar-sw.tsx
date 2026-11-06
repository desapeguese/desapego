"use client";

import { useEffect } from "react";

/**
 * O service worker só faz uma coisa: mostrar a tela "sem conexão" quando uma
 * navegação falha. Fica restrito a /app, sem tocar na landing, e só em
 * produção, para não atrapalhar o desenvolvimento com cache.
 */
export function RegistrarSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/app" }).catch(() => {});
  }, []);
  return null;
}
