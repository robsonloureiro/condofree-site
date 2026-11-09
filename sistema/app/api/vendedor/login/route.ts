import { NextRequest } from "next/server";
import {
  buscarVendedorPorEmail,
  verificaSenha,
  criarSessaoVendedor,
  definirCookieSessaoVendedor,
  encerrarSessaoVendedor,
  vendedorDaSessao,
} from "@/lib/vendedores";

// GET: verifica se há um vendedor logado.
export async function GET() {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) return Response.json({ ok: true, autenticado: false });
  const { senhaHash: _, ...publico } = vendedor;
  return Response.json({ ok: true, autenticado: true, vendedor: publico });
}

// POST: login do vendedor (e-mail + senha criados pelo dono do CondoFree).
export async function POST(req: NextRequest) {
  const { email, senha } = await req.json();
  if (!email || !senha) {
    return Response.json({ ok: false, erro: "Informe e-mail e senha." }, { status: 400 });
  }
  const vendedor = await buscarVendedorPorEmail(String(email));
  if (!vendedor || !vendedor.ativo || !verificaSenha(String(senha), vendedor.senhaHash)) {
    return Response.json({ ok: false, erro: "E-mail ou senha inválidos." }, { status: 401 });
  }
  const token = await criarSessaoVendedor(vendedor.id);
  definirCookieSessaoVendedor(token);
  const { senhaHash: _, ...publico } = vendedor;
  return Response.json({ ok: true, vendedor: publico });
}

// DELETE: sair.
export async function DELETE() {
  await encerrarSessaoVendedor();
  return Response.json({ ok: true });
}
