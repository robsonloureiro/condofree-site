import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { usuarioDaSessao } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: false, erro: "Faça login." }, { status: 401 });
  }
  const form = await req.formData();
  const arquivo = form.get("foto") as File | null;
  if (!arquivo) {
    return Response.json({ ok: false, erro: "Nenhuma foto enviada." }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ ok: false, erro: "Upload de fotos indisponível no momento." }, { status: 500 });
  }
  const ext = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  // Pasta opcional ("fotos" ou "anexos") só para organizar o Blob.
  const pasta = form.get("pasta") === "anexos" ? "anexos" : "fotos";
  const nome = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  // O store do Blob é PRIVADO e rejeita upload público ("Cannot use public
  // access on a private store"). A foto fica privada e é servida pelo
  // proxy /api/foto, que busca o arquivo com o token no servidor — o
  // painel usa o proxy para URLs com ?download=1 (ver srcFoto).
  let blob;
  try {
    blob = await put(nome, arquivo, { access: "private", addRandomSuffix: true });
  } catch (e) {
    console.error("upload foto falhou:", e);
    return Response.json({ ok: false, erro: "Falha no envio da foto. Tente novamente." }, { status: 500 });
  }
  return Response.json({ ok: true, url: blob.downloadUrl });
}
