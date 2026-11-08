import { usuarioDaSessao } from "@/lib/auth";
import { enviarPushParaUsuarios, listarInscricoes } from "@/lib/push";

// Envia uma notificação de teste para o próprio usuário (o aparelho que
// chamou). Serve para conferir na hora se o push chega no celular.
export async function POST() {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: false, erro: "Entre de novo para testar." }, { status: 401 });
  }
  const inscricoes = await listarInscricoes();
  const temInscricao = inscricoes.some((i) => i.usuarioId === usuario.id);
  if (!temInscricao) {
    return Response.json(
      { ok: false, erro: "Nenhuma inscrição ativa neste aparelho. Desative e ative as notificações de novo." },
      { status: 400 },
    );
  }
  await enviarPushParaUsuarios([usuario.id], {
    titulo: "CondoFree — notificação de teste 🔔",
    corpo: "Se você viu esta notificação, as notificações estão funcionando neste aparelho.",
  });
  return Response.json({ ok: true });
}
