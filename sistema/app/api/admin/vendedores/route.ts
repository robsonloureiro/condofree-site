import { NextRequest } from "next/server";
import { usuarioDaSessao } from "@/lib/auth";
import {
  listarVendedores,
  salvarVendedores,
  criarVendedor,
  calcularComissoes,
  hashSenha,
  COMISSAO_TAXA,
  COMISSAO_MESES,
} from "@/lib/vendedores";
import { listarCondominios, salvarCondominios, carregarDados, salvarDados } from "@/lib/dados";
import { readJSON, writeJSON } from "@/lib/store";

// Área do dono do CondoFree: gerenciar vendedores e vincular condomínios.
// Acesso restrito ao e-mail do dono (ADMIN_EMAIL ou o e-mail do Robson).
function ehDono(email: string | undefined | null): boolean {
  const admin = (process.env.ADMIN_EMAIL || "rob.animacoes@gmail.com").toLowerCase();
  return !!email && email.toLowerCase() === admin;
}

async function exigirDono() {
  const usuario = await usuarioDaSessao();
  if (!usuario) return { ok: false as const, resposta: Response.json({ ok: false, erro: "Faça login." }, { status: 401 }) };
  if (!ehDono(usuario.email)) {
    return { ok: false as const, resposta: Response.json({ ok: false, erro: "Acesso restrito ao dono do CondoFree." }, { status: 403 }) };
  }
  return { ok: true as const, usuario };
}

// GET: lista vendedores (com resumo de comissões) + condomínios (com vendedor atual).
export async function GET() {
  const auth = await exigirDono();
  if (!auth.ok) return auth.resposta;
  const vendedores = await listarVendedores();
  const condominios = await listarCondominios();
  const lista = vendedores.map((v) => {
    const meus = condominios.filter((c) => c.vendedorId === v.id);
    const resumo = calcularComissoes(meus);
    const { senhaHash: _, ...publico } = v;
    return { ...publico, resumo };
  });
  const condos = condominios.map((c) => ({
    id: c.id,
    nome: c.nome,
    unidades: c.unidades,
    criadoEm: c.criadoEm,
    assinaturaStatus: c.assinaturaStatus,
    assinaturaPlanoId: c.assinaturaPlanoId || null,
    vendedorId: c.vendedorId || null,
  }));
  return Response.json({
    ok: true,
    vendedores: lista,
    condominios: condos,
    comissaoTaxa: COMISSAO_TAXA,
    comissaoMeses: COMISSAO_MESES,
  });
}

// POST: criar um vendedor (nome, e-mail, senha). Gera o código de indicação.
export async function POST(req: NextRequest) {
  const auth = await exigirDono();
  if (!auth.ok) return auth.resposta;
  const { nome, email, senha } = await req.json();
  if (!nome || !email || !senha) {
    return Response.json({ ok: false, erro: "Preencha nome, e-mail e senha." }, { status: 400 });
  }
  if (String(senha).length < 6) {
    return Response.json({ ok: false, erro: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  }
  try {
    const vendedor = await criarVendedor(String(nome), String(email), String(senha));
    const { senhaHash: _, ...publico } = vendedor;
    return Response.json({ ok: true, vendedor: publico });
  } catch (e: any) {
    return Response.json({ ok: false, erro: e?.message || "Não foi possível criar o vendedor." }, { status: 400 });
  }
}

// PATCH: alternar ativo/inativo de um vendedor, ou vincular/desvincular
// um condomínio a um vendedor.
export async function PATCH(req: NextRequest) {
  const auth = await exigirDono();
  if (!auth.ok) return auth.resposta;
  const body = await req.json();
  const { acao } = body as { acao: string };

  if (acao === "alternarAtivo") {
    const vendedores = await listarVendedores();
    const v = vendedores.find((x) => x.id === body.id);
    if (!v) return Response.json({ ok: false, erro: "Vendedor não encontrado." }, { status: 404 });
    v.ativo = !v.ativo;
    await salvarVendedores(vendedores);
    return Response.json({ ok: true, ativo: v.ativo });
  }

  if (acao === "redefinirSenha") {
    const { id, novaSenha } = body as { id: string; novaSenha: string };
    if (!novaSenha || String(novaSenha).length < 6) {
      return Response.json({ ok: false, erro: "A nova senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
    }
    const vendedores = await listarVendedores();
    const v = vendedores.find((x) => x.id === id);
    if (!v) return Response.json({ ok: false, erro: "Vendedor não encontrado." }, { status: 404 });
    v.senhaHash = hashSenha(String(novaSenha));
    await salvarVendedores(vendedores);
    return Response.json({ ok: true });
  }

  if (acao === "excluir") {
    const vendedores = await listarVendedores();
    const v = vendedores.find((x) => x.id === body.id);
    if (!v) return Response.json({ ok: false, erro: "Vendedor não encontrado." }, { status: 404 });
    await salvarVendedores(vendedores.filter((x) => x.id !== body.id));
    // Encerra as sessões do vendedor excluído.
    const sessoes = await readJSON<any[]>("db/sessoes-vendedores.json", []);
    await writeJSON(
      "db/sessoes-vendedores.json",
      sessoes.filter((s) => s.vendedorId !== body.id),
    );
    // Desvincula os condomínios dele (ficam sem vendedor).
    const condominios = await listarCondominios();
    const desvinculados: string[] = [];
    for (const c of condominios) {
      if (c.vendedorId === body.id) {
        c.vendedorId = null;
        desvinculados.push(c.id);
      }
    }
    if (desvinculados.length > 0) {
      await salvarCondominios(condominios);
      for (const id of desvinculados) {
        const dados = await carregarDados(id);
        if (dados && dados.condominio.vendedorId === body.id) {
          dados.condominio.vendedorId = null;
          await salvarDados(dados);
        }
      }
    }
    return Response.json({ ok: true });
  }

  if (acao === "vincular") {
    const { condominioId, vendedorId } = body as { condominioId: string; vendedorId: string | null };
    if (!condominioId) return Response.json({ ok: false, erro: "Informe o condomínio." }, { status: 400 });
    if (vendedorId) {
      const vendedores = await listarVendedores();
      if (!vendedores.some((v) => v.id === vendedorId)) {
        return Response.json({ ok: false, erro: "Vendedor não encontrado." }, { status: 404 });
      }
    }
    // Atualiza o registro (lista) e os dados do condomínio (arquivo próprio).
    const condominios = await listarCondominios();
    const c = condominios.find((x) => x.id === condominioId);
    if (!c) return Response.json({ ok: false, erro: "Condomínio não encontrado." }, { status: 404 });
    c.vendedorId = vendedorId || null;
    await salvarCondominios(condominios);
    const dados = await carregarDados(condominioId);
    if (dados) {
      dados.condominio.vendedorId = vendedorId || null;
      await salvarDados(dados);
    }
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
}
