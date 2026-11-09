import { NextRequest } from "next/server";
import {
  vendedorDaSessao,
  listarLeads,
  salvarLeads,
  criarLead,
  STATUS_LEAD,
} from "@/lib/vendedores";
import { hojeISO } from "@/lib/store";

const STATUS_VALIDOS = STATUS_LEAD.map((s) => s.id);

// GET: meus leads (funil de prospecção).
export async function GET() {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const leads = await listarLeads(vendedor.id);
  const porStatus: Record<string, number> = {};
  for (const s of STATUS_VALIDOS) porStatus[s] = 0;
  for (const l of leads) porStatus[l.status] = (porStatus[l.status] || 0) + 1;
  return Response.json({ ok: true, leads, porStatus });
}

// POST: criar um lead.
export async function POST(req: NextRequest) {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const body = await req.json();
  const nomeCondominio = String(body.nomeCondominio || "").trim();
  if (!nomeCondominio) {
    return Response.json({ ok: false, erro: "Informe o nome do condomínio." }, { status: 400 });
  }
  const lead = await criarLead(vendedor.id, {
    nomeCondominio,
    contato: body.contato,
    telefone: body.telefone,
    cidade: body.cidade,
    observacao: body.observacao,
  });
  return Response.json({ ok: true, lead });
}

// PATCH: atualizar um lead (status, campos ou observação). Só os meus.
export async function PATCH(req: NextRequest) {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const body = await req.json();
  const todos = await listarLeads();
  const lead = todos.find((l) => l.id === body.id && l.vendedorId === vendedor.id);
  if (!lead) return Response.json({ ok: false, erro: "Lead não encontrado." }, { status: 404 });
  if (body.status !== undefined) {
    if (!STATUS_VALIDOS.includes(body.status)) {
      return Response.json({ ok: false, erro: "Status inválido." }, { status: 400 });
    }
    lead.status = body.status;
  }
  if (body.nomeCondominio !== undefined) {
    const nome = String(body.nomeCondominio || "").trim();
    if (!nome) return Response.json({ ok: false, erro: "Informe o nome do condomínio." }, { status: 400 });
    lead.nomeCondominio = nome;
  }
  if (body.contato !== undefined) lead.contato = String(body.contato || "").trim() || null;
  if (body.telefone !== undefined) lead.telefone = String(body.telefone || "").trim() || null;
  if (body.cidade !== undefined) lead.cidade = String(body.cidade || "").trim() || null;
  if (body.observacao !== undefined) lead.observacao = String(body.observacao || "").trim() || null;
  lead.atualizadoEm = hojeISO();
  await salvarLeads(todos);
  return Response.json({ ok: true, lead });
}

// DELETE: excluir um lead. Só os meus.
export async function DELETE(req: NextRequest) {
  const vendedor = await vendedorDaSessao();
  if (!vendedor) {
    return Response.json({ ok: false, erro: "Faça login como vendedor." }, { status: 401 });
  }
  const body = await req.json();
  const todos = await listarLeads();
  const lead = todos.find((l) => l.id === body.id && l.vendedorId === vendedor.id);
  if (!lead) return Response.json({ ok: false, erro: "Lead não encontrado." }, { status: 404 });
  await salvarLeads(todos.filter((l) => l.id !== body.id));
  return Response.json({ ok: true });
}
