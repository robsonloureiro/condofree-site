import { NextRequest } from "next/server";
import { listarCondominios } from "@/lib/dados";

// Mostra o nome do condomínio a partir do código de convite, para o
// morador confirmar que está entrando no condomínio certo antes de
// criar a conta. Público (sem login): o código já é o segredo que o
// síndico compartilha, e só o nome é revelado — nenhum dado de morador.
export async function GET(req: NextRequest) {
  const codigo = (req.nextUrl.searchParams.get("codigo") || "").trim().toUpperCase();
  if (!codigo) {
    return Response.json({ ok: false, erro: "Informe o código de convite." }, { status: 400 });
  }
  const condominios = await listarCondominios();
  const condominio = condominios.find((c) => c.codigoConvite.toUpperCase() === codigo);
  if (!condominio) {
    return Response.json({ ok: false, erro: "Código de convite inválido." }, { status: 400 });
  }
  return Response.json({ ok: true, nome: condominio.nome });
}
