import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/serpapi";
import { interpretQuery, rankCompatibleParts } from "@/lib/ai";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { detectMotherboardPlatform, type MotherboardPlatform } from "@/lib/pcCompatibility";
import type { Product, RankedProduct } from "@/lib/types";

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

    // Pre-filtro deterministico PRIMA di coinvolgere l'AI: separiamo le schede di cui siamo
    // certi (socket/RAM rilevati da regex su chipset/nomi reali) da quelle incerte. L'AI vede
    // solo le prime, così non può mai smentire un dato già confermato dal codice (è successo
    // in test: un'AI ha dichiarato "inesistente" una scheda Z790 DDR4 realmente in vendita).
    const detected: { product: Product; platform: MotherboardPlatform }[] = [];
    const undetected: Product[] = [];
    for (const p of products) {
      const platform = detectMotherboardPlatform(p);
      if (platform) detected.push({ product: p, platform });
      else undetected.push(p);
    }

    const { items: rankedDetected, summary, technicianTip } = await rankCompatibleParts(
      `Schede madri per: ${effectiveQuery}`,
      detected.map((d) => d.product)
    );

    const platformById = new Map(detected.map((d) => [d.product.id, d.platform]));
    const rankedOptions: MotherboardOption[] = rankedDetected.map((item) => ({
      ...item,
      platform: platformById.get(item.id) ?? null,
    }));

    const undetectedOptions: MotherboardOption[] = undetected
      .sort((a, b) => a.price - b.price)
      .map((product) => ({
        ...product,
        aiScore: 0,
        aiReason:
          "Non è stato possibile confermare automaticamente socket e tipo di RAM dal titolo: verifica le specifiche sul sito del venditore prima di scegliere questa scheda.",
        bestValue: false,
        platform: null,
      }));

    const finalSummary =
      products.length === 0
        ? "Nessuna scheda madre trovata per questa ricerca."
        : rankedOptions.length === 0
          ? "Non è stato possibile confermare automaticamente la compatibilità di nessuna scheda trovata: controlla manualmente le opzioni qui sotto."
          : summary;

    return NextResponse.json({
      query,
      items: [...rankedOptions, ...undetectedOptions],
      summary: finalSummary,
      technicianTip,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
