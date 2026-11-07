import { NextRequest } from "next/server";
import { buscarPendente } from "@/lib/google-pendente";

// Lê o cadastro pendente do Google: a tela /completar-cadastro usa
// para mostrar o e-mail verificado e o nome já preenchido.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const pendente = await buscarPendente(token);
  if (!pendente) {
    return Response.json(
      { ok: false, erro: "Link expirado. Entre com o Google novamente." },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, email: pendente.email, nome: pendente.nome });
}
