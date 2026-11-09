import { vendedorDaSessao, calcularComissoes } from "@/lib/vendedores";
import { listarCondominios } from "@/lib/dados";

// GET: dados do painel do vendedor logado — portfólio de condomínios
// fechados + comissões (ganho, a receber, total, parcelas restantes).
export async function GET() {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const condominios = await listarCondominios();
  const meus = condominios.filter((c) => c.vendedorId === vendedor.id);
  const resumo = calcularComissoes(meus);
  const { senhaHash: _, ...publico } = vendedor;
  return Response.json({
    ok: true,
    vendedor: publico,
    resumo,
  });
}
