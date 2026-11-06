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
  const nome = `fotos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const blob = await put(nome, arquivo, { access: "private", addRandomSuffix: true });
  return Response.json({ ok: true, url: blob.downloadUrl });
}
