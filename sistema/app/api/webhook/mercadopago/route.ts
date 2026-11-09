import { NextRequest } from "next/server";
import { listarUsuarios } from "@/lib/auth";
import { carregarDados, salvarDados, listarCondominios, salvarCondominios } from "@/lib/dados";
import { criarAviso } from "@/lib/vendedores";

/**
 * Webhook do Mercado Pago (notificações de assinatura).
 * Precisa da variável MP_ACCESS_TOKEN configurada no projeto Vercel.
 * Sem ela, a notificação é apenas registrada e a ativação aguarda a configuração.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tipo = body?.type || body?.topic;
  const id = body?.data?.id || body?.resource?.split("/").pop();
  if (tipo !== "preapproval" || !id) {
    return Response.json({ ok: true, ignorado: true });
  }
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ ok: true, pendente: "MP_ACCESS_TOKEN não configurado" });
  }
  const res = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return Response.json({ ok: false }, { status: 400 });
  const pre = await res.json();
  if (pre.status !== "authorized") {
    return Response.json({ ok: true, status: pre.status });
  }
  const email = pre.payer_email as string | undefined;
  if (!email) return Response.json({ ok: true, semEmail: true });
  const usuarios = await listarUsuarios();
  const usuario = usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.papel === "sindico");
  if (!usuario) return Response.json({ ok: true, usuarioNaoEncontrado: true });
  const dados = await carregarDados(usuario.condominioId);
  if (!dados) return Response.json({ ok: true, condominioNaoEncontrado: true });
  dados.condominio.assinaturaStatus = "ativa";
  dados.condominio.assinaturaPreapprovalId = String(id);
  dados.condominio.assinaturaPlanoId = String(pre.preapproval_plan_id || "");
  // Início da assinatura (primeiro pagamento): base da janela de 24 meses
  // da comissão do vendedor. Só marca uma vez.
  const primeiraAtivacao = !dados.condominio.assinaturaInicio;
  if (!dados.condominio.assinaturaInicio) {
    dados.condominio.assinaturaInicio = new Date().toISOString();
  }
  await salvarDados(dados);
  const condominios = await listarCondominios();
  const c = condominios.find((x) => x.id === dados.condominio.id);
  if (c) {
    c.assinaturaStatus = "ativa";
    c.assinaturaPreapprovalId = String(id);
    if (!c.assinaturaInicio) c.assinaturaInicio = dados.condominio.assinaturaInicio;
    await salvarCondominios(condominios);
  }
  // Avisa o vendedor que a assinatura ativou (a comissão começou) — só na primeira vez.
  if (primeiraAtivacao && dados.condominio.vendedorId) {
    try {
      await criarAviso(dados.condominio.vendedorId, "assinatura_ativa", `Assinatura ativa: ${dados.condominio.nome}`, "A comissão de 50% começou a contar.");
    } catch {}
  }
  return Response.json({ ok: true, ativado: true });
}
