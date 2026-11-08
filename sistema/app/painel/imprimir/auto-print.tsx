"use client";
import { useEffect } from "react";

// Abre o diálogo de impressão assim que a página de impressão carrega.
// A página é um documento simples (só a prestação de contas), sem o painel,
// para o celular gerar a prévia sem travar.
export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}
