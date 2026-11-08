import { listarUsuarios, usuarioDaSessao } from "@/lib/auth";
import { listarInscricoes } from "@/lib/push";

// Resumo de notificações do condomínio (só o síndico vê): quantos
// moradores têm notificação ativada — ou seja, quantos vão receber
// os avisos e votações que ele publicar.
export async function GET() {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: false, erro: "Faça login." }, { status: 401 });
  }
  if (usuario.papel !== "sindico") {
    return Response.json({ ok: false, erro: "Só o síndico vê este resumo." }, { status: 403 });
  }
  const usuarios = await listarUsuarios();
  const moradores = usuarios.filter(
    (u) => u.condominioId === usuario.condominioId && u.papel === "morador",
  );
  const inscricoes = await listarInscricoes();
  const comNotificacao = moradores.filter((m) =>
    inscricoes.some((i) => i.usuarioId === m.id),
  ).length;
  return Response.json({ ok: true, moradores: moradores.length, comNotificacao });
}
