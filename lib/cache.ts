import { promises as fs } from "fs";
import os from "os";
import path from "path";

const CACHE_DIR = path.join(os.tmpdir(), "confronta-elettronica-ai-cache");

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function cacheFilePath(key: string) {
  const safeKey = Buffer.from(key).toString("base64url");
  return path.join(CACHE_DIR, `${safeKey}.json`);
}

export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const filePath = cacheFilePath(key);
    const raw = await fs.readFile(filePath, "utf-8");
    const { timestamp, data } = JSON.parse(raw) as { timestamp: number; data: T };
    if (Date.now() - timestamp > ttlMs) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  await ensureCacheDir();
  const filePath = cacheFilePath(key);
  await fs.writeFile(filePath, JSON.stringify({ timestamp: Date.now(), data }), "utf-8");
}
