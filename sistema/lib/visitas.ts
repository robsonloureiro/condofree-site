// Controle de visitas do CondoFree (só o dono vê o painel).
// Uma visita = uma pessoa por dia. Sem IP, sem dado pessoal: guarda só
// o papel (sindico/morador/vendedor/visitante), a data e uma chave
// anônima de dedupe (id do usuário logado ou id aleatório do visitante).
import { readJSON, writeJSON } from "./store";
import type { Visita, PapelVisita } from "./types";

export type { Visita, PapelVisita };

const ARQUIVO = "db/visitas.json";
const FUSO = "America/Sao_Paulo";

// Data de hoje (YYYY-MM-DD) no fuso de São Paulo.
export function dataHojeSP(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

// Lista de datas (YYYY-MM-DD) dos últimos n dias, terminando hoje (SP).
export function ultimasDatasSP(n: number): string[] {
  const agora = Date.now();
  const datas: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    datas.push(dataHojeSP(new Date(agora - i * 24 * 60 * 60 * 1000)));
  }
  return datas;
}

export async function listarVisitas(): Promise<Visita[]> {
  return readJSON<Visita[]>(ARQUIVO, []);
}

async function salvarVisitas(lista: Visita[]): Promise<void> {
  // Mantém só os últimos 400 dias para o arquivo não crescer sem fim.
  const corte = dataHojeSP(new Date(Date.now() - 400 * 24 * 60 * 60 * 1000));
  await writeJSON(
    ARQUIVO,
    lista.filter((v) => v.data >= corte),
  );
}

// Registra uma visita. Dedupe: mesma chave no mesmo dia conta uma vez só.
// Retorna true quando a visita foi registrada (nova) e false quando já
// existia uma visita dessa chave hoje.
export async function registrarVisita(
  papel: PapelVisita,
  chave: string,
  pagina?: string,
): Promise<boolean> {
  const hoje = dataHojeSP();
  const lista = await listarVisitas();
  if (lista.some((v) => v.data === hoje && v.chave === chave)) return false;
  lista.push({
    id: `vis_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    data: hoje,
    papel,
    chave,
    pagina: pagina ? String(pagina).slice(0, 80) : null,
    criadoEm: new Date().toISOString(),
  });
  await salvarVisitas(lista);
  return true;
}

export interface TotaisPapel {
  hoje: number;
  ultimos7: number;
  ultimos30: number;
  total: number;
}

export interface LinhaDia {
  data: string; // YYYY-MM-DD
  sindico: number;
  morador: number;
  vendedor: number;
  visitante: number;
  total: number;
}

export interface ResumoVisitas {
  porPapel: Record<PapelVisita, TotaisPapel>;
  geral: TotaisPapel;
  porDia: LinhaDia[]; // últimos 30 dias, do mais antigo ao mais recente
}

const PAPEIS: PapelVisita[] = ["sindico", "morador", "vendedor", "visitante"];

function vazio(): TotaisPapel {
  return { hoje: 0, ultimos7: 0, ultimos30: 0, total: 0 };
}

export async function resumoVisitas(): Promise<ResumoVisitas> {
  const lista = await listarVisitas();
  const hoje = dataHojeSP();
  const ultimas7 = new Set(ultimasDatasSP(7));
  const ultimas30 = new Set(ultimasDatasSP(30));
  const porPapel: Record<PapelVisita, TotaisPapel> = {
    sindico: vazio(),
    morador: vazio(),
    vendedor: vazio(),
    visitante: vazio(),
  };
  const geral = vazio();
  for (const v of lista) {
    const t = porPapel[v.papel] || porPapel.visitante;
    t.total += 1;
    geral.total += 1;
    if (v.data === hoje) {
      t.hoje += 1;
      geral.hoje += 1;
    }
    if (ultimas7.has(v.data)) {
      t.ultimos7 += 1;
      geral.ultimos7 += 1;
    }
    if (ultimas30.has(v.data)) {
      t.ultimos30 += 1;
      geral.ultimos30 += 1;
    }
  }
  const porDia: LinhaDia[] = ultimasDatasSP(30).map((data) => {
    const linha: LinhaDia = { data, sindico: 0, morador: 0, vendedor: 0, visitante: 0, total: 0 };
    for (const v of lista) {
      if (v.data !== data) continue;
      linha[v.papel] = (linha[v.papel] || 0) + 1;
      linha.total += 1;
    }
    return linha;
  });
  return { porPapel, geral, porDia };
}
