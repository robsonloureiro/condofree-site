import { NextRequest } from "next/server";
import { listarUsuarios } from "@/lib/auth";
import { seedDemo } from "@/lib/seed";

/** Cria os dados de demonstração (Condomínio Exemplo) — só se ainda não existir ninguém. */
export async function POST(_req: NextRequest) {
  const usuarios = await listarUsuarios();
  if (usuarios.length > 0) {
    return Response.json({ ok: false, erro: "Já existem contas criadas." }, { status: 400 });
  }
  await seedDemo();
  return Response.json({ ok: true });
}
