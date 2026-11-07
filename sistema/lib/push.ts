import * as webpush from "web-push";
import { readJSON, writeJSON } from "./store";
import { listarUsuarios } from "./auth";

// Notificações push do CondoFree (Web Push / PWA): o morador ativa na
// aba Ajuda e o sistema avisa quando o síndico cria aviso ou votação,
// ou quando a reserva dele é aprovada/recusada. Sem as chaves VAPID
// configuradas na Vercel, o envio simplesmente não acontece — nada quebra.
export interface InscricaoPush {
  usuarioId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  criadoEm: string;
}

export interface PayloadPush {
  titulo: string;
  corpo: string;
  url?: string;
}

const CHAVE = "db/push-inscricoes.json";

function vapid(): { pub: string; priv: string; subj: string } | null {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  return { pub, priv, subj: process.env.VAPID_SUBJECT || "mailto:contato@condofree.com.br" };
}

export async function listarInscricoes(): Promise<InscricaoPush[]> {
  return readJSON<InscricaoPush[]>(CHAVE, []);
}

export async function salvarInscricoes(lista: InscricaoPush[]): Promise<void> {
  await writeJSON(CHAVE, lista);
}

async function enviarPara(insc: InscricaoPush, payload: PayloadPush): Promise<"ok" | "expirada" | "falha"> {
  const cfg = vapid();
  if (!cfg) return "falha";
  try {
    webpush.setVapidDetails(cfg.subj, cfg.pub, cfg.priv);
    await webpush.sendNotification(
      { endpoint: insc.endpoint, keys: insc.keys } as unknown as webpush.PushSubscription,
      JSON.stringify({ ...payload, url: payload.url || "/painel" }),
    );
    return "ok";
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode;
    // 410/404 = inscrição expirada ou cancelada no navegador: remover.
    if (status === 410 || status === 404) return "expirada";
    console.error("push falhou:", status || e);
    return "falha";
  }
}

export async function enviarPushParaUsuarios(usuarioIds: string[], payload: PayloadPush): Promise<void> {
  if (!vapid() || usuarioIds.length === 0) return;
  const lista = await listarInscricoes();
  const alvos = lista.filter((i) => usuarioIds.includes(i.usuarioId));
  if (alvos.length === 0) return;
  const expiradas: string[] = [];
  await Promise.all(
    alvos.map(async (insc) => {
      if ((await enviarPara(insc, payload)) === "expirada") expiradas.push(insc.endpoint);
    }),
  );
  if (expiradas.length > 0) {
    await salvarInscricoes(lista.filter((i) => !expiradas.includes(i.endpoint)));
  }
}

// Avisa todos os moradores de um condomínio (o síndico não recebe, ele criou).
export async function enviarPushParaCondominio(condominioId: string, payload: PayloadPush): Promise<void> {
  const usuarios = await listarUsuarios();
  const ids = usuarios
    .filter((u) => u.condominioId === condominioId && u.papel === "morador")
    .map((u) => u.id);
  await enviarPushParaUsuarios(ids, payload);
}
