import { NextRequest } from "next/server";
import { encerrarSessao } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  await encerrarSessao();
  return Response.json({ ok: true });
}
