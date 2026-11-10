// Controle de visitas do CondoFree (só o dono vê o painel).
// A contagem é por IP DISTINTO: quantos IPs diferentes acessaram, não
// quantas vezes cada um acessou. O IP em si não é guardado — só um hash
// dele, suficiente para contar IPs distintos sem armazenar o endereço.
// Sem dado pessoal.
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

// Chave de identidade do IP para contagem. Registros antigos (sem ipHash)
// usam a chave do usuário, para continuarem contando como um IP cada.
function identidadeIP(v: Visita): string {
  return v.ipHash || `legado:${v.chave}`;
}

// Registra um acesso. Dedupe: mesmo IP, mesmo papel, mesmo dia conta uma
// vez só. Retorna true quando foi registrado (novo) e false quando esse
// IP já tinha sido contado nesse papel hoje.
export async function registrarVisita(
  papel: PapelVisita,
  chave: string,
  ipHash: string,
  pagina?: string,
): Promise<boolean> {
  const hoje = dataHojeSP();
  const lista = await listarVisitas();
  if (lista.some((v) => v.data === hoje && v.papel === papel && identidadeIP(v) === ipHash)) {
    return false;
  }
  lista.push({
    id: `vis_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    data: hoje,
    papel,
    chave,
    ipHash,
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

// Conta IPs DISTINTOS (não acessos): um IP que aparece em vários dias
// conta uma vez só dentro de cada período.
export async function resumoVisitas(): Promise<ResumoVisitas> {
  const lista = await listarVisitas();
  const hoje = dataHojeSP();
  const ultimas7 = new Set(ultimasDatasSP(7));
  const ultimas30 = new Set(ultimasDatasSP(30));

  // Conjuntos de IPs distintos por papel e período.
  const sets: Record<PapelVisita, { hoje: Set<string>; ultimos7: Set<string>; ultimos30: Set<string>; total: Set<string> }> = {
    sindico: { hoje: new Set(), ultimos7: new Set(), ultimos30: new Set(), total: new Set() },
    morador: { hoje: new Set(), ultimos7: new Set(), ultimos30: new Set(), total: new Set() },
    vendedor: { hoje: new Set(), ultimos7: new Set(), ultimos30: new Set(), total: new Set() },
    visitante: { hoje: new Set(), ultimos7: new Set(), ultimos30: new Set(), total: new Set() },
  };
  const geralSets = { hoje: new Set<string>(), ultimos7: new Set<string>(), ultimos30: new Set<string>(), total: new Set<string>() };

  for (const v of lista) {
    const ip = identidadeIP(v);
    const s = sets[v.papel] || sets.visitante;
    s.total.add(ip);
    geralSets.total.add(ip);
    if (v.data === hoje) {
      s.hoje.add(ip);
      geralSets.hoje.add(ip);
    }
    if (ultimas7.has(v.data)) {
      s.ultimos7.add(ip);
      geralSets.ultimos7.add(ip);
    }
    if (ultimas30.has(v.data)) {
      s.ultimos30.add(ip);
      geralSets.ultimos30.add(ip);
    }
  }

  const porPapel: Record<PapelVisita, TotaisPapel> = {
    sindico: vazio(),
    morador: vazio(),
    vendedor: vazio(),
    visitante: vazio(),
  };
  for (const p of PAPEIS) {
    porPapel[p] = {
      hoje: sets[p].hoje.size,
      ultimos7: sets[p].ultimos7.size,
      ultimos30: sets[p].ultimos30.size,
      total: sets[p].total.size,
    };
  }
  const geral: TotaisPapel = {
    hoje: geralSets.hoje.size,
    ultimos7: geralSets.ultimos7.size,
    ultimos30: geralSets.ultimos30.size,
    total: geralSets.total.size,
  };

  // Por dia: IPs distintos por papel naquele dia + total de IPs distintos do dia.
  const porDia: LinhaDia[] = ultimasDatasSP(30).map((data) => {
    const dia: Record<PapelVisita, Set<string>> = {
      sindico: new Set(),
      morador: new Set(),
      vendedor: new Set(),
      visitante: new Set(),
    };
    const todos = new Set<string>();
    for (const v of lista) {
      if (v.data !== data) continue;
      const ip = identidadeIP(v);
      dia[v.papel].add(ip);
      todos.add(ip);
    }
    return {
      data,
      sindico: dia.sindico.size,
      morador: dia.morador.size,
      vendedor: dia.vendedor.size,
      visitante: dia.visitante.size,
      total: todos.size,
    };
  });

  return { porPapel, geral, porDia };
}
