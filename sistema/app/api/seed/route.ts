import { NextRequest } from "next/server";
import { listarUsuarios } from "@/lib/auth";
import { seedDemo } from "@/lib/seed";

/** Cria os dados de demonstração (Condomínio Exemplo) — só se ainda não existir ninguém. */
export async function POST(_req: NextRequest) {
  try {
    const usuarios = await listarUsuarios();
    if (usuarios.length > 0) {
      return Response.json({ ok: false, erro: "Já existem contas criadas." }, { status: 400 });
    }
    await seedDemo();
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, erro: "seed-falhou", detalhe: msg.slice(0, 500) }, { status: 500 });
  }
}
