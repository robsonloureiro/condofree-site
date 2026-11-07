import { usuarioDaSessao } from "@/lib/auth";
import { listarInscricoes } from "@/lib/push";

// Diz se o usuário logado já tem uma inscrição push ativa.
export async function GET() {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: false, erro: "Faça login." }, { status: 401 });
  }
  const lista = await listarInscricoes();
  return Response.json({ ok: true, inscrito: lista.some((i) => i.usuarioId === usuario.id) });
}
