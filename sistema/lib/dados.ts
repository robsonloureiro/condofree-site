import { readJSON, writeJSON } from "./store";
import { novoId } from "./auth";
import type { DadosCondominio, Condominio } from "./types";

/** Gera as cobranças recorrentes do mês, se for o dia (ou depois) e ainda
 * não existirem. Roda no carregamento do painel: a cobrança do dia 1
 * aparece no primeiro acesso do mês, sem precisar de agendador.
 * Retorna true quando criou alguma cobrança (quem chama deve salvar). */
export function gerarCobrancasRecorrentes(dados: DadosCondominio): boolean {
  const tpl = dados.condominio.cobrancaRecorrente;
  if (!tpl) return false;
  const hoje = new Date();
  const mes = hoje.toISOString().slice(0, 7);
  const dia = Math.min(Math.max(1, tpl.dia || 1), 28);
  if (hoje.getDate() < dia) return false;
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const vencimento = `${mes}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
  let criou = false;
  for (const morador of dados.moradores) {
    const jaExiste = dados.boletos.some(
      (b) => b.moradorId === morador.id && b.mes === mes && (b.descricao || "") === tpl.descricao,
    );
    if (jaExiste) continue;
    dados.boletos.push({
      id: novoId("bol"),
      moradorId: morador.id,
      moradorNome: morador.nome,
      valor: tpl.valor,
      vencimento,
      status: "pendente",
      codigoBarras: null,
      mes,
      descricao: tpl.descricao,
      comprovanteUrl: null,
    });
    criou = true;
  }
  return criou;
}

export async function carregarDados(condominioId: string): Promise<DadosCondominio | null> {
  return readJSON<DadosCondominio | null>(`db/condos/${condominioId}.json`, null);
}

export async function salvarDados(dados: DadosCondominio): Promise<void> {
  await writeJSON(`db/condos/${dados.condominio.id}.json`, dados);
}

export async function listarCondominios(): Promise<Condominio[]> {
  return readJSON<Condominio[]>("db/condominios.json", []);
}

export async function salvarCondominios(lista: Condominio[]): Promise<void> {
  await writeJSON("db/condominios.json", lista);
}

/** O condomínio pode criar itens? Trial válido ou assinatura ativa. */
export function podeCriar(condominio: Condominio): boolean {
  if (condominio.assinaturaStatus === "ativa") return true;
  if (condominio.assinaturaStatus === "trial") {
    return new Date(condominio.trialFim) >= new Date();
  }
  return false;
}

export function statusAssinatura(condominio: Condominio): {
  texto: string;
  diasRestantes: number;
} {
  if (condominio.assinaturaStatus === "ativa") {
    return { texto: "Assinatura ativa", diasRestantes: -1 };
  }
  if (condominio.assinaturaStatus === "cancelada") {
    return { texto: "Assinatura cancelada", diasRestantes: 0 };
  }
  const fim = new Date(condominio.trialFim);
  const dias = Math.ceil((fim.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { texto: "Teste grátis encerrado", diasRestantes: 0 };
  return { texto: `Em teste grátis até ${fim.toLocaleDateString("pt-BR")} — faltam ${dias} dia(s)`, diasRestantes: dias };
}

export function erroCriacaoBloqueada(): Response {
  return Response.json(
    { ok: false, erro: "O teste grátis acabou. Assine o CondoFree para continuar criando." },
    { status: 403 }
  );
}
