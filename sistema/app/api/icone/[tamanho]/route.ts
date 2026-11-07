import { NextRequest } from "next/server";
import { ICON_192_DATA_URI, ICON_512_DATA_URI, ICON_512_MASKABLE_DATA_URI } from "@/lib/icones-pwa";

// Serve os ícones do app (PWA) a partir dos data URIs em lib/icones-pwa.ts.
// O manifest e o service worker apontam para cá — os arquivos PNG não
// vão para o repositório porque o envio ao GitHub rejeita binário.
const ICONES: Record<string, string> = {
  "192": ICON_192_DATA_URI,
  "512": ICON_512_DATA_URI,
  "512-maskable": ICON_512_MASKABLE_DATA_URI,
};

export async function GET(_req: NextRequest, { params }: { params: { tamanho: string } }) {
  const dataUri = ICONES[params.tamanho];
  if (!dataUri) {
    return new Response("Ícone não encontrado.", { status: 404 });
  }
  const base64 = dataUri.split(",")[1];
  const buf = Buffer.from(base64, "base64");
  return new Response(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
