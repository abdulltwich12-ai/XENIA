import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data", "preferences");
const MAX_EVENTS = 200; // evita che il file cresca all'infinito

const STOPWORDS = new Set([
  "per",
  "con",
  "del",
  "della",
  "dei",
  "delle",
  "e",
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "un",
  "una",
  "di",
  "da",
  "in",
  "su",
  "a",
  "cm",
  "mm",
  "pollici",
  "pack",
  "set",
]);

export type FeedbackSignal = "like" | "dislike";

export type FeedbackEvent = {
  productId: string;
  title: string;
  price: number;
  currency: string;
  source: string;
  specs?: string[];
  signal: FeedbackSignal;
  query: string;
  timestamp: number;
};

function filePath(userId: string) {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${safeId}.json`);
}

async function readEvents(userId: string): Promise<FeedbackEvent[]> {
  try {
    const raw = await fs.readFile(filePath(userId), "utf-8");
    return JSON.parse(raw) as FeedbackEvent[];
  } catch {
    return [];
  }
}

export async function recordFeedback(
  userId: string,
  event: Omit<FeedbackEvent, "timestamp">
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const events = await readEvents(userId);
  events.push({ ...event, timestamp: Date.now() });
  const trimmed = events.slice(-MAX_EVENTS);
  await fs.writeFile(filePath(userId), JSON.stringify(trimmed), "utf-8");
}

function topWords(events: FeedbackEvent[]): string[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const text = [e.title, ...(e.specs ?? [])].join(" ").toLowerCase();
    const words = text.match(/[a-zà-ÿ0-9]+/g) ?? [];
    for (const w of words) {
      if (w.length < 3 || STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

export async function getPreferenceSummary(userId: string): Promise<string | null> {
  const events = await readEvents(userId);
  if (events.length < 2) return null; // troppo poco storico per essere utile

  const liked = events.filter((e) => e.signal === "like");
  const disliked = events.filter((e) => e.signal === "dislike");

  const parts: string[] = [];

  if (liked.length > 0) {
    const avgPrice = liked.reduce((s, e) => s + e.price, 0) / liked.length;
    const words = topWords(liked);
    const sources = [...new Set(liked.map((e) => e.source))].slice(0, 3);
    parts.push(
      `Prodotti apprezzati in passato: prezzo medio intorno a ${avgPrice.toFixed(0)} EUR${
        words.length ? `, parole/caratteristiche ricorrenti: ${words.join(", ")}` : ""
      }${sources.length ? `, spesso da: ${sources.join(", ")}` : ""}.`
    );
  }

  if (disliked.length > 0) {
    const words = topWords(disliked);
    if (words.length) {
      parts.push(`Prodotti scartati in passato avevano spesso: ${words.join(", ")}.`);
    }
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}
