import "./globals.css";
import type { Metadata } from "next";
import { ICON_DATA_URI } from "@/lib/logo";

export const metadata: Metadata = {
  title: "CondoFree — Gestão de condomínios",
  description: "Mais controle, zero burocracia. Gestão simples para condomínios de 20 a 100 unidades.",
  icons: { icon: ICON_DATA_URI, apple: ICON_DATA_URI },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
