import { NextRequest } from "next/server";
import {
  vendedorDaSessao,
  listarVendedores,
  salvarVendedores,
} from "@/lib/vendedores";

// POST: o vendedor cadastra/altera a própria chave Pix para receber comissões.
export async function POST(req: NextRequest) {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const { pixChave } = await req.json();
  const chave = String(pixChave || "").trim();
  if (chave.length > 100) {
    return Response.json({ ok: false, erro: "Chave Pix muito longa." }, { status: 400 });
  }
  const vendedores = await listarVendedores();
  const v = vendedores.find((x) => x.id === vendedor.id);
  if (!v) return Response.json({ ok: false, erro: "Vendedor não encontrado." }, { status: 404 });
  v.pixChave = chave || null;
  await salvarVendedores(vendedores);
  return Response.json({ ok: true, pixChave: v.pixChave });
}
