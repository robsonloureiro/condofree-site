import { NextRequest } from "next/server";
import { usuarioDaSessao } from "@/lib/auth";
import { listarInscricoes, salvarInscricoes } from "@/lib/push";

// Remove a inscrição push do usuário logado.
export async function POST(req: NextRequest) {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: false, erro: "Faça login." }, { status: 401 });
  }
  const corpo = await req.json();
  const endpoint = String(corpo?.endpoint || "");
  if (!endpoint) {
    return Response.json({ ok: false, erro: "Informe a inscrição." }, { status: 400 });
  }
  const lista = await listarInscricoes();
  await salvarInscricoes(
    lista.filter((i) => !(i.endpoint === endpoint && i.usuarioId === usuario.id)),
  );
  return Response.json({ ok: true });
}
