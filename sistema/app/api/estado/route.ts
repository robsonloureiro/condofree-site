import { usuarioDaSessao } from "@/lib/auth";
import { carregarDados, statusAssinatura } from "@/lib/dados";

export async function GET() {
  const usuario = await usuarioDaSessao();
  if (!usuario) {
    return Response.json({ ok: true, autenticado: false });
  }
  const dados = await carregarDados(usuario.condominioId);
  if (!dados) {
    return Response.json({ ok: false, erro: "Condomínio não encontrado." }, { status: 404 });
  }
  const { senhaHash: _, ...usuarioPublico } = usuario;
  const eu = dados.moradores.find((m) => m.usuarioId === usuario.id) || null;
  const status = statusAssinatura(dados.condominio);
  const meusBoletos =
    usuario.papel === "morador" && eu
      ? dados.boletos.filter((b) => b.moradorId === eu.id)
      : dados.boletos;
  const lancamentos =
    usuario.papel === "sindico" ? dados.lancamentos : [];
  const resumoFinanceiro = (() => {
    const mes = new Date().toISOString().slice(0, 7);
    const doMes = dados.lancamentos.filter((l) => l.data.slice(0, 7) === mes);
    const entradas = doMes.filter((l) => l.tipo === "receita" && l.pago).reduce((s, l) => s + l.valor, 0);
    const saidas = doMes.filter((l) => l.tipo === "despesa" && l.pago).reduce((s, l) => s + l.valor, 0);
    return { mes, entradas, saidas, saldo: entradas - saidas };
  })();

  return Response.json({
    ok: true,
    autenticado: true,
    usuario: usuarioPublico,
    condominio: dados.condominio,
    statusAssinatura: status,
    eu,
    moradores: dados.moradores,
    espacos: dados.espacos,
    reservas: dados.reservas,
    avisos: dados.avisos,
    ocorrencias: dados.ocorrencias,
    boletos: meusBoletos,
    votacoes: dados.votacoes,
    lancamentos,
    resumoFinanceiro,
    funcionarios: usuario.papel === "sindico" ? (dados.funcionarios ?? []) : [],
    folhas: usuario.papel === "sindico" ? (dados.folhas ?? []) : [],
    pedidosCorrecao:
      usuario.papel === "sindico"
        ? dados.pedidosCorrecao
        : dados.pedidosCorrecao.filter((p) => eu && p.moradorId === eu.id),
  });
}
