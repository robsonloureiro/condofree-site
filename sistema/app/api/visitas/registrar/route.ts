import { NextRequest } from "next/server";
import crypto from "crypto";
import { usuarioDaSessao } from "@/lib/auth";
import { vendedorDaSessao } from "@/lib/vendedores";
import { registrarVisita } from "@/lib/visitas";
import type { PapelVisita } from "@/lib/types";

// Registra uma visita (uma pessoa por dia). O papel vem da sessão:
// síndico/morador (cookie condofree-token), vendedor (cookie
// condofree-vendedor-token) ou visitante (sem sessão). Sem IP, sem dado
// pessoal — só papel, data e chave anônima de dedupe.
const ORIGENS_PERMITIDAS = [
  "https://condofree.com.br",
  "https://www.condofree.com.br",
  "https://app.condofree.com.br",
];

function corsHeaders(req: NextRequest): Record<string, string> {
  const origem = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
  if (ORIGENS_PERMITIDAS.includes(origem)) {
    headers["Access-Control-Allow-Origin"] = origem;
  }
  return headers;
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  let anonId: string | null = null;
  let pagina: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.anonId === "string" && body.anonId.trim()) {
      anonId = body.anonId.trim().slice(0, 80);
    }
    if (typeof body?.pagina === "string" && body.pagina.trim()) {
      pagina = body.pagina.trim();
    }
  } catch {
    // Corpo inválido: registra mesmo assim como visitante anônimo.
  }

  let papel: PapelVisita = "visitante";
  let chave: string;
  const usuario = await usuarioDaSessao().catch(() => null);
  if (usuario) {
    papel = usuario.papel; // "sindico" | "morador"
    chave = `u:${usuario.id}`;
  } else {
    const vendedor = await vendedorDaSessao().catch(() => null);
    if (vendedor) {
      papel = "vendedor";
      chave = `v:${vendedor.id}`;
    } else {
      if (!anonId) anonId = `an-${crypto.randomUUID()}`;
      chave = `a:${anonId}`;
    }
  }

  const registrado = await registrarVisita(papel, chave, pagina);
  return Response.json(
    { ok: true, registrado, papel, anonId: papel === "visitante" ? anonId : null },
    { headers },
  );
}
