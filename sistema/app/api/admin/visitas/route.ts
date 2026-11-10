import { usuarioDaSessao } from "@/lib/auth";
import { resumoVisitas } from "@/lib/visitas";

// Painel de visitas — só o dono do CondoFree vê.
// Acesso restrito ao e-mail do dono (ADMIN_EMAIL ou o e-mail do Robson).
function ehDono(email: string | undefined | null): boolean {
  const admin = (process.env.ADMIN_EMAIL || "rob.animacoes@gmail.com").toLowerCase();
  return !!email && email.toLowerCase() === admin;
}

export async function GET() {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: false, erro: "Faça login." }, { status: 401 });
  }
  if (!ehDono(usuario.email)) {
    return Response.json({ ok: false, erro: "Acesso restrito ao dono do CondoFree." }, { status: 403 });
  }
  const resumo = await resumoVisitas();
  return Response.json({ ok: true, ...resumo });
}
