"use client";
import { useEffect } from "react";

// Ações da página de impressão + abertura automática do diálogo de imprimir.
// Fica num Client Component porque botões com onClick não podem viver
// num Server Component (dava erro 500 na rota /painel/imprimir).
export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="acoes">
      <button className="principal" onClick={() => window.print()}>Imprimir</button>
      <a href="/painel">Voltar ao painel</a>
    </div>
  );
}
