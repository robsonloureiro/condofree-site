import { NextRequest } from "next/server";
import {
  vendedorDaSessao,
  verificaSenha,
  hashSenha,
  listarVendedores,
  salvarVendedores,
} from "@/lib/vendedores";

// POST: o vendedor troca a própria senha (senha atual + nova senha).
export async function POST(req: NextRequest) {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const { senhaAtual, novaSenha } = await req.json();
  if (!senhaAtual || !novaSenha) {
    return Response.json({ ok: false, erro: "Preencha a senha atual e a nova senha." }, { status: 400 });
  }
  if (String(novaSenha).length < 6) {
    return Response.json({ ok: false, erro: "A nova senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  }
  if (!verificaSenha(String(senhaAtual), vendedor.senhaHash)) {
    return Response.json({ ok: false, erro: "A senha atual está incorreta." }, { status: 401 });
  }
  const vendedores = await listarVendedores();
  const v = vendedores.find((x) => x.id === vendedor.id);
  if (!v) return Response.json({ ok: false, erro: "Vendedor não encontrado." }, { status: 404 });
  v.senhaHash = hashSenha(String(novaSenha));
  await salvarVendedores(vendedores);
  return Response.json({ ok: true });
}
