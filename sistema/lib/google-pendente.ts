import crypto from "crypto";
import { readJSON, writeJSON } from "./store";

// Cadastro com Google em duas etapas: o callback do Google prova o
// e-mail e cria um cadastro pendente de curta duração; a tela
// /completar-cadastro usa esse token para criar a conta SEM senha
// (o login passa a ser só pelo Google). O token é de uso único e
// expira em 15 minutos, então ninguém cria conta com e-mail alheio.
export interface CadastroPendente {
  token: string;
  email: string;
  nome: string;
  expiraEm: string;
}

const CHAVE = "db/google-pendentes.json";

export async function criarPendente(email: string, nome: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const lista = await readJSON<CadastroPendente[]>(CHAVE, []);
  const agora = Date.now();
  const validos = lista.filter((p) => new Date(p.expiraEm).getTime() > agora);
  validos.push({
    token,
    email,
    nome,
    expiraEm: new Date(agora + 15 * 60 * 1000).toISOString(),
  });
  await writeJSON(CHAVE, validos);
  return token;
}

export async function buscarPendente(token: string): Promise<CadastroPendente | null> {
  const lista = await readJSON<CadastroPendente[]>(CHAVE, []);
  const achado = lista.find((p) => p.token === token) || null;
  if (!achado) return null;
  if (new Date(achado.expiraEm).getTime() < Date.now()) return null;
  return achado;
}

export async function removerPendente(token: string): Promise<void> {
  const lista = await readJSON<CadastroPendente[]>(CHAVE, []);
  await writeJSON(
    CHAVE,
    lista.filter((p) => p.token !== token),
  );
}
