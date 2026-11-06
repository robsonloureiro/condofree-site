import { put, get } from "@vercel/blob";
import fs from "fs";
import path from "path";

// Armazenamento: em produção usa Vercel Blob (BLOB_READ_WRITE_TOKEN).
// O store é privado — por isso access: "private" no put/get (SDK v2).
// Sem o token (desenvolvimento local), usa arquivos JSON em ./data.
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const DATA_DIR = path.join(process.cwd(), "data");

function localPath(key: string) {
  return path.join(DATA_DIR, key);
}

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    if (useBlob) {
      const res = await get(key, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return fallback;
      const text = await new Response(res.stream).text();
      return JSON.parse(text) as T;
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
    await put(key, body, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
    });
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
