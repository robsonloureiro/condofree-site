import { NextRequest } from "next/server";
import {
  vendedorDaSessao,
  listarAvisos,
  marcarAvisosLidos,
} from "@/lib/vendedores";

// GET: meus avisos (novos condomínios indicados, assinaturas ativas) + não lidos.
export async function GET() {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const avisos = await listarAvisos(vendedor.id);
  const naoLidos = avisos.filter((a) => !a.lido).length;
  return Response.json({ ok: true, avisos: avisos.slice(0, 20), naoLidos });
}

// POST: marcar todos como lidos.
export async function POST(req: NextRequest) {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.acao === "marcarLidas") {
    await marcarAvisosLidos(vendedor.id);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, erro: "Ação inválida." }, { status: 400 });
}
