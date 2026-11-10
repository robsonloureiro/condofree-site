"use client";
import { useEffect } from "react";

// Registra uma visita por sessão do navegador. O servidor deduz o papel
// (síndico/morador/vendedor/visitante) pela sessão e conta uma visita por
// pessoa por dia — recarregar a página não infla o número. Silencioso:
// nunca bloqueia a página nem mostra erro.
export default function RegistrarVisita() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("condofree-visita-registrada")) return;
      sessionStorage.setItem("condofree-visita-registrada", "1");
      let anonId = "";
      try {
        anonId = localStorage.getItem("condofree-visitante-id") || "";
        if (!anonId) {
          anonId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? `an-${crypto.randomUUID()}`
              : `an-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
          localStorage.setItem("condofree-visitante-id", anonId);
        }
      } catch {
        anonId = "";
      }
      fetch("/api/visitas/registrar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId: anonId || undefined, pagina: window.location.pathname }),
      }).catch(() => {});
    } catch {
      // Sem storage disponível: não registra, não quebra nada.
    }
  }, []);
  return null;
}
