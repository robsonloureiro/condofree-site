import crypto from "crypto";
import { cookies } from "next/headers";
import { readJSON, writeJSON, uid, hojeISO } from "./store";
import type { Usuario, Sessao } from "./types";

const COOKIE = "condofree-token";

export function hashSenha(senha: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(senha, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verificaSenha(senha: string, senhaHash: string): boolean {
  const [salt, hash] = senhaHash.split(":");
  if (!salt || !hash) return false;
  const calc = crypto.pbkdf2Sync(senha, salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash));
}

export async function listarUsuarios(): Promise<Usuario[]> {
  return readJSON<Usuario[]>("db/usuarios.json", []);
}

export async function salvarUsuarios(usuarios: Usuario[]): Promise<void> {
  await writeJSON("db/usuarios.json", usuarios);
}

export async function criarSessao(usuarioId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const sessoes = await readJSON<Sessao[]>("db/sessoes.json", []);
  const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  sessoes.push({ token, usuarioId, expiraEm: expira });
  await writeJSON("db/sessoes.json", sessoes);
  return token;
}

export async function usuarioDaSessao(): Promise<Usuario | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const sessoes = await readJSON<Sessao[]>("db/sessoes.json", []);
  const sessao = sessoes.find((s) => s.token === token);
  if (!sessao || new Date(sessao.expiraEm) < new Date()) return null;
  const usuarios = await listarUsuarios();
  return usuarios.find((u) => u.id === sessao.usuarioId) || null;
}

export async function encerrarSessao(): Promise<void> {
  const token = cookies().get(COOKIE)?.value;
  if (token) {
    const sessoes = await readJSON<Sessao[]>("db/sessoes.json", []);
    await writeJSON(
      "db/sessoes.json",
      sessoes.filter((s) => s.token !== token)
    );
  }
  cookies().set(COOKIE, "", { maxAge: 0, path: "/" });
}

export function definirCookieSessao(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function novoId(prefixo: string): string {
  return uid(prefixo);
}

export { hojeISO };
