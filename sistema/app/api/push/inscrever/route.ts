import { NextRequest } from "next/server";
import { usuarioDaSessao } from "@/lib/auth";
import { listarInscricoes, salvarInscricoes, type InscricaoPush } from "@/lib/push";

// Salva (ou atualiza) a inscrição push do usuário logado.
export async function POST(req: NextRequest) {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: false, erro: "Faça login." }, { status: 401 });
  }
  const corpo = await req.json();
  const sub = corpo?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return Response.json({ ok: false, erro: "Inscrição inválida." }, { status: 400 });
  }
  const lista = await listarInscricoes();
  const semEssa = lista.filter((i) => i.endpoint !== sub.endpoint);
  const inscricao: InscricaoPush = {
    usuarioId: usuario.id,
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    criadoEm: new Date().toISOString(),
  };
  semEssa.push(inscricao);
  await salvarInscricoes(semEssa);
  return Response.json({ ok: true });
}
