"use client";
import { useEffect } from "react";

// Registra o service worker do CondoFree (notificações push). Sem ele,
// o navegador não recebe push nem oferece a instalação como app.
export default function PwaRegistro() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
