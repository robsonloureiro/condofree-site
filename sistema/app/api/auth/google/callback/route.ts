import { NextRequest, NextResponse } from "next/server";
import { listarUsuarios, criarSessao } from "@/lib/auth";
import { criarPendente } from "@/lib/google-pendente";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const COOKIE_SESSAO = "condofree-token";

function erro(req: NextRequest, codigo: string) {
  return NextResponse.redirect(new URL(`/?erro=${codigo}`, req.url));
}

// Callback do Google: troca o code por tokens, confirma o e-mail no Google e,
// se existir conta CondoFree com esse e-mail, cria a sessão e entra no painel.
// O Google só prova que a pessoa é dona do e-mail; conta nova continua sendo
// criada pelo cadastro normal (o morador precisa usar o e-mail cadastrado).
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return erro(req, "google-nao-configurado");

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return erro(req, "google-cancelado");

  const stateCookie = req.cookies.get("condofree-oauth-state")?.value;
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return erro(req, "google-erro");
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  let tokens: { access_token?: string };
  try {
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    tokens = await r.json();
  } catch {
    return erro(req, "google-erro");
  }
  if (!tokens?.access_token) return erro(req, "google-erro");

  let perfil: { email?: string; email_verified?: boolean; name?: string };
  try {
    const r = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    perfil = await r.json();
  } catch {
    return erro(req, "google-erro");
  }
  const email = String(perfil?.email || "").toLowerCase();
  if (!email || perfil?.email_verified !== true) return erro(req, "google-erro");

  const usuarios = await listarUsuarios();
  const usuario = usuarios.find((u) => u.email.toLowerCase() === email);
  if (!usuario) {
    // Sem conta CondoFree com esse e-mail: o Google prova quem a pessoa
    // é, e ela completa o cadastro SEM senha na tela /completar-cadastro
    // (síndico: nome do condomínio + unidades; morador: código, bloco e
    // apartamento — o nome do condomínio aparece ao digitar o código).
    // O token pendente expira em 15 minutos e só vale uma vez.
    const token = await criarPendente(email, String(perfil?.name || ""));
    return NextResponse.redirect(new URL(`/completar-cadastro?token=${token}`, req.url));
  }

  const token = await criarSessao(usuario.id);
  const res = NextResponse.redirect(new URL("/painel", req.url));
  res.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  res.cookies.set("condofree-oauth-state", "", { maxAge: 0, path: "/" });
  return res;
}
