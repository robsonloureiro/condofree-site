import crypto from "crypto";
import { cookies } from "next/headers";
import { readJSON, writeJSON, hojeISO } from "./store";
import { hashSenha, verificaSenha } from "./auth";
import type { Vendedor, SessaoVendedor, Condominio } from "./types";

export { hashSenha, verificaSenha };

// ---------- Constantes da comissão ----------
// O vendedor ganha 50% de cada mensalidade PAGA nos primeiros 24 meses.
// Promo: R$ 9,90/mês nos 6 primeiros meses; depois R$ 97/mês.
export const COMISSAO_TAXA = 0.5;
export const COMISSAO_MESES = 24;
export const COMISSAO_MESES_PROMO = 6;
export const PLANO_PROMOCIONAL_ID = "b6d59f07efcd4142b013b9d2f7519261";
export const PLANO_MENSAL_ID = "c70e5c528b6f4bad8b11a517cdeca831";
export const PRECO_PROMOCIONAL = 9.9;
export const PRECO_MENSAL = 97;

const COOKIE_VENDEDOR = "condofree-vendedor-token";
const ARQUIVO_VENDEDORES = "db/vendedores.json";
const ARQUIVO_SESSOES = "db/sessoes-vendedores.json";

// ---------- Contas de vendedor ----------

export async function listarVendedores(): Promise<Vendedor[]> {
  return readJSON<Vendedor[]>(ARQUIVO_VENDEDORES, []);
}

export async function salvarVendedores(lista: Vendedor[]): Promise<void> {
  await writeJSON(ARQUIVO_VENDEDORES, lista);
}

export async function buscarVendedorPorId(id: string): Promise<Vendedor | null> {
  const lista = await listarVendedores();
  return lista.find((v) => v.id === id) || null;
}

export async function buscarVendedorPorEmail(email: string): Promise<Vendedor | null> {
  const lista = await listarVendedores();
  return lista.find((v) => v.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function buscarVendedorPorCodigo(codigo: string): Promise<Vendedor | null> {
  const lista = await listarVendedores();
  const c = String(codigo || "").trim().toUpperCase();
  if (!c) return null;
  return lista.find((v) => v.codigo.toUpperCase() === c && v.ativo) || null;
}

function gerarCodigo(): string {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
}

export async function criarVendedor(nome: string, email: string, senha: string): Promise<Vendedor> {
  const lista = await listarVendedores();
  if (lista.some((v) => v.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("Já existe um vendedor com esse e-mail.");
  }
  let codigo = gerarCodigo();
  while (lista.some((v) => v.codigo === codigo)) codigo = gerarCodigo();
  const vendedor: Vendedor = {
    id: `ven_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    senhaHash: hashSenha(senha),
    codigo,
    criadoEm: hojeISO(),
    ativo: true,
  };
  lista.push(vendedor);
  await salvarVendedores(lista);
  return vendedor;
}

// ---------- Sessão do vendedor (cookie separado da sessão de síndico/morador) ----------

export async function criarSessaoVendedor(vendedorId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const sessoes = await readJSON<SessaoVendedor[]>(ARQUIVO_SESSOES, []);
  const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  sessoes.push({ token, vendedorId, expiraEm: expira });
  await writeJSON(ARQUIVO_SESSOES, sessoes);
  return token;
}

export async function vendedorDaSessao(): Promise<Vendedor | null> {
  const token = cookies().get(COOKIE_VENDEDOR)?.value;
  if (!token) return null;
  const sessoes = await readJSON<SessaoVendedor[]>(ARQUIVO_SESSOES, []);
  const sessao = sessoes.find((s) => s.token === token);
  if (!sessao || new Date(sessao.expiraEm) < new Date()) return null;
  const vendedor = await buscarVendedorPorId(sessao.vendedorId);
  return vendedor && vendedor.ativo ? vendedor : null;
}

export async function encerrarSessaoVendedor(): Promise<void> {
  const token = cookies().get(COOKIE_VENDEDOR)?.value;
  if (token) {
    const sessoes = await readJSON<SessaoVendedor[]>(ARQUIVO_SESSOES, []);
    await writeJSON(
      ARQUIVO_SESSOES,
      sessoes.filter((s) => s.token !== token),
    );
  }
  cookies().set(COOKIE_VENDEDOR, "", { maxAge: 0, path: "/" });
}

export function definirCookieSessaoVendedor(token: string) {
  cookies().set(COOKIE_VENDEDOR, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

// ---------- Comissões ----------

// Valor da mensalidade do condomínio no mês m (1-based) a partir do início
// da assinatura, para os meses JÁ DECORRIDOS (ganho): se o condomínio está
// no plano promocional agora, os meses decorridos foram promocionais.
export function valorMensalidadeNoMes(condominio: Condominio, mes: number): number {
  if (condominio.assinaturaPlanoId === PLANO_PROMOCIONAL_ID) return PRECO_PROMOCIONAL;
  if (mes <= COMISSAO_MESES_PROMO) return PRECO_PROMOCIONAL;
  return PRECO_MENSAL;
}

// Valor da mensalidade no mês m para a PROJEÇÃO (meses futuros e total
// cheio): o caminho padrão é promo nos 6 primeiros meses e R$ 97 depois.
// É o que dá R$ 902,70 de comissão por condomínio nos 24 meses.
export function valorMensalidadeProjetado(mes: number): number {
  if (mes <= COMISSAO_MESES_PROMO) return PRECO_PROMOCIONAL;
  return PRECO_MENSAL;
}

function mesesDecorridos(inicioISO: string, agora: Date): number {
  const inicio = new Date(inicioISO);
  if (isNaN(inicio.getTime()) || inicio > agora) return 0;
  let meses =
    (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth());
  // Só conta o mês quando o dia do mês já passou.
  if (agora.getDate() < inicio.getDate()) meses -= 1;
  return Math.max(0, Math.min(COMISSAO_MESES, meses));
}

export interface ComissaoCondominio {
  condominioId: string;
  nome: string;
  criadoEm: string;
  assinaturaInicio: string | null;
  status: Condominio["assinaturaStatus"];
  planoId: string | null;
  comissaoMensalAtual: number;
  mesesDecorridos: number;
  mesesRestantes: number;
  ganho: number; // comissão dos meses já decorridos (assinatura ativa)
  aReceber: number; // comissão dos meses restantes (só conta se a assinatura está ativa)
  total: number; // ganho + aReceber
  projecaoTotal: number; // valor cheio dos 24 meses (R$ 902,70 se completar)
}

export interface ResumoComissoes {
  condominios: ComissaoCondominio[];
  totalCondominios: number;
  condominiosAtivos: number;
  totalGanho: number;
  totalAReceber: number;
  totalGeral: number;
  parcelasAReceber: number; // quantas mensalidades de comissão faltam receber
}

export function calcularComissoes(condominios: Condominio[]): ResumoComissoes {
  const agora = new Date();
  const lista: ComissaoCondominio[] = condominios.map((c) => {
    const inicio = c.assinaturaInicio || c.criadoEm;
    const decorridos = c.assinaturaStatus === "trial" ? 0 : mesesDecorridos(inicio, agora);
    const restantes =
      c.assinaturaStatus === "ativa" ? Math.max(0, COMISSAO_MESES - decorridos) : 0;
    let ganho = 0;
    for (let m = 1; m <= decorridos; m++) {
      ganho += valorMensalidadeNoMes(c, m) * COMISSAO_TAXA;
    }
    let aReceber = 0;
    for (let m = decorridos + 1; m <= COMISSAO_MESES; m++) {
      aReceber += valorMensalidadeProjetado(m) * COMISSAO_TAXA;
    }
    if (c.assinaturaStatus !== "ativa") aReceber = 0;
    let projecao = 0;
    for (let m = 1; m <= COMISSAO_MESES; m++) {
      projecao += valorMensalidadeProjetado(m) * COMISSAO_TAXA;
    }
    const comissaoMensalAtual =
      c.assinaturaStatus === "trial"
        ? 0
        : valorMensalidadeNoMes(c, Math.max(1, decorridos)) * COMISSAO_TAXA;
    return {
      condominioId: c.id,
      nome: c.nome,
      criadoEm: c.criadoEm,
      assinaturaInicio: c.assinaturaInicio || null,
      status: c.assinaturaStatus,
      planoId: c.assinaturaPlanoId || null,
      comissaoMensalAtual,
      mesesDecorridos: decorridos,
      mesesRestantes: restantes,
      ganho: Math.round(ganho * 100) / 100,
      aReceber: Math.round(aReceber * 100) / 100,
      total: Math.round((ganho + aReceber) * 100) / 100,
      projecaoTotal: Math.round(projecao * 100) / 100,
    };
  });
  const totalGanho = lista.reduce((s, x) => s + x.ganho, 0);
  const totalAReceber = lista.reduce((s, x) => s + x.aReceber, 0);
  const parcelasAReceber = lista.reduce((s, x) => s + x.mesesRestantes, 0);
  return {
    condominios: lista,
    totalCondominios: lista.length,
    condominiosAtivos: lista.filter((x) => x.status === "ativa").length,
    totalGanho: Math.round(totalGanho * 100) / 100,
    totalAReceber: Math.round(totalAReceber * 100) / 100,
    totalGeral: Math.round((totalGanho + totalAReceber) * 100) / 100,
    parcelasAReceber,
  };
}
