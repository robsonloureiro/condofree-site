import "./globals.css";
import type { Metadata } from "next";
import PwaRegistro from "./pwa";
import RegistrarVisita from "./components/RegistrarVisita";

export const metadata: Metadata = {
  title: "CondoFree — Gestão de condomínios",
  description: "Mais controle, zero burocracia. Gestão simples para condomínios de 20 a 100 unidades.",
  manifest: "/manifest.json",
  themeColor: "#0b2a4a",
  appleWebApp: { capable: true, title: "CondoFree", statusBarStyle: "default" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/api/icone/192" sizes="any" />
        <link rel="apple-touch-icon" href="/api/icone/192" />
      </head>
      <body>
        <PwaRegistro />
        <RegistrarVisita />
        {children}
      </body>
    </html>
  );
}
