import { NextRequest } from "next/server";
import { buscarVendedorPorCodigo } from "@/lib/vendedores";

// Público: resolve o código de indicação para o nome do vendedor
// (mostrado na tela de cadastro do síndico). Revela só o nome.
export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get("codigo") || "";
  const vendedor = await buscarVendedorPorCodigo(codigo);
  if (!vendedor) return Response.json({ ok: false });
  return Response.json({ ok: true, nome: vendedor.nome });
}
