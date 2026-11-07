import { NextRequest } from "next/server";
import { usuarioDaSessao } from "@/lib/auth";

// Serve fotos de ocorrências, que ficam no Blob PRIVADO (a URL guardada
// termina em ?download=1). O <img> não autentica, então o servidor
// busca o arquivo com o token do Blob e devolve os bytes. Só aceita
// URLs do Blob da Vercel (host público ou privado) e só para usuário logado.
export async function GET(req: NextRequest) {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return new Response("Faça login.", { status: 401 });
  }
  const u = req.nextUrl.searchParams.get("u");
  if (!u) {
    return new Response("Falta a foto.", { status: 400 });
  }
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return new Response("URL inválida.", { status: 400 });
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".blob.vercel-storage.com")) {
    return new Response("URL não permitida.", { status: 400 });
  }
  url.searchParams.delete("download");
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const res = await fetch(
    url.toString(),
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  if (!res.ok) {
    return new Response("Foto não encontrada.", { status: res.status });
  }
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
