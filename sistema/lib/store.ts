import fs from "fs";
import path from "path";

// Armazenamento: em produção usa Vercel Blob via API REST (BLOB_READ_WRITE_TOKEN).
// Sem o token (desenvolvimento local), usa arquivos JSON em ./data.
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const DATA_DIR = path.join(process.cwd(), "data");
const BLOB_API = "https://blob.vercel-storage.com";

function blobHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    "x-api-version": "8",
    ...extra,
  };
}

async function blobList(prefix: string): Promise<{ url: string; pathname: string }[]> {
  const res = await fetch(`${BLOB_API}/?prefix=${encodeURIComponent(prefix)}&limit=10`, {
    headers: blobHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.blobs || []) as { url: string; pathname: string }[];
}

async function blobGet(url: string): Promise<unknown | null> {
  const res = await fetch(url, { headers: blobHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function blobPut(key: string, body: string): Promise<void> {
  const res = await fetch(`${BLOB_API}/${key}`, {
    method: "PUT",
    headers: blobHeaders({
      "Content-Type": "application/json",
      "x-add-random-suffix": "0",
      "x-access": "private",
    }),
    body,
  });
  if (!res.ok) {
    throw new Error(`Falha ao salvar ${key}: ${res.status}`);
  }
}

function localPath(key: string) {
  return path.join(DATA_DIR, key);
}

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    if (useBlob) {
      const blobs = await blobList(key);
      const hit = blobs.find((b) => b.pathname === key);
      if (!hit) return fallback;
      const data = await blobGet(hit.url);
      return (data ?? fallback) as T;
    }
    const p = localPath(key);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value, null, 2);
  if (useBlob) {
    await blobPut(key, body);
    return;
  }
  const p = localPath(key);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, "utf-8");
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function hojeISO(): string {
  return new Date().toISOString();
}

export function dataBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
