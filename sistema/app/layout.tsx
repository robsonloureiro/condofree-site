import "./globals.css";
import type { Metadata } from "next";
import { ICON_DATA_URI } from "../lib/logo";

export const metadata: Metadata = {
  title: "CondoFree — Gestão de condomínios",
  description: "Mais controle, zero burocracia. Gestão simples para condomínios de 20 a 100 unidades.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href={ICON_DATA_URI} sizes="any" />
        <link rel="apple-touch-icon" href={ICON_DATA_URI} />
      </head>
      <body>{children}</body>
    </html>
  );
}
