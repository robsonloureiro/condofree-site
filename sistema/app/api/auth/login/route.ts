import { NextRequest } from "next/server";
import { usuarioDaSessao, listarUsuarios, verificaSenha, criarSessao, definirCookieSessao } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json();
  if (!email || !senha) {
    return Response.json({ ok: false, erro: "Informe e-mail e senha." }, { status: 400 });
  }
  const usuarios = await listarUsuarios();
  const usuario = usuarios.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!usuario || !verificaSenha(String(senha), usuario.senhaHash)) {
    return Response.json({ ok: false, erro: "E-mail ou senha inválidos." }, { status: 401 });
  }
  const token = await criarSessao(usuario.id);
  definirCookieSessao(token);
  return Response.json({ ok: true });
}

export async function GET() {
  const usuario = await usuarioDaSessao();
  if (!usuario) return Response.json({ ok: false, autenticado: false });
  const { senhaHash: _, ...publico } = usuario;
  return Response.json({ ok: true, autenticado: true, usuario: publico });
}
