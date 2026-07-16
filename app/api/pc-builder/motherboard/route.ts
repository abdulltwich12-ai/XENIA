import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/serpapi";
import { interpretQuery } from "@/lib/ai";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { rankWithDetection } from "@/lib/pcBuilderRanking";
import { detectMotherboardPlatform, type MotherboardPlatform } from "@/lib/pcCompatibility";
import type { RankedProduct } from "@/lib/types";

const MAX_QUERY_LENGTH = 300;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const SEARCH_LIMIT = 20; // molti verranno scartati dal filtro di compatibilità, ne cerchiamo di più

export type MotherboardOption = RankedProduct & { platform: MotherboardPlatform | null };

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = checkRateLimit(
    `pcbuilder-mobo:${ip}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Troppe richieste: riprova tra qualche istante." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let query: string;
  try {
    const body = await req.json();
    query = typeof body.query === "string" ? body.query.trim().slice(0, MAX_QUERY_LENGTH) : "";
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "Il campo 'query' è obbligatorio" }, { status: 400 });
  }

  // Se l'utente non menziona esplicitamente la categoria, la aggiungiamo per garantire
  // che la ricerca resti sulle schede madri (non su altri componenti).
  const effectiveQuery = /scheda\s*madre|motherboard|mainboard/i.test(query)
    ? query
    : `scheda madre ${query}`;

  try {
    const intent = await interpretQuery(effectiveQuery, null);
    let products = await searchProducts(intent.searchQuery, SEARCH_LIMIT, {
      maxPrice: intent.maxPrice,
    });
    if (products.length === 0 && intent.searchQuery.toLowerCase() !== effectiveQuery.toLowerCase()) {
      products = await searchProducts(effectiveQuery, SEARCH_LIMIT, { maxPrice: intent.maxPrice });
    }

    const { items, summary, technicianTip } = await rankWithDetection(
      `Schede madri per: ${effectiveQuery}`,
      products,
      detectMotherboardPlatform,
      "Non è stato possibile confermare automaticamente socket e tipo di RAM dal titolo: verifica le specifiche sul sito del venditore prima di scegliere questa scheda."
    );

    const options: MotherboardOption[] = items.map(({ meta, ...item }) => ({
      ...item,
      platform: meta,
    }));

    return NextResponse.json({ query, items: options, summary, technicianTip });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
