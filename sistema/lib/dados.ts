import { readJSON, writeJSON } from "./store";
import type { DadosCondominio, Condominio } from "./types";

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
