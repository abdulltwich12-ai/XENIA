import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/serpapi";
import { interpretQuery, rankProducts } from "@/lib/ai";
import { getPreferenceSummary } from "@/lib/preferences";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import type { RecommendResponse } from "@/lib/types";

const MAX_QUERY_LENGTH = 300;
const RATE_LIMIT = 10; // richieste
const RATE_WINDOW_MS = 60 * 1000; // per minuto

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = checkRateLimit(`recommend:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Troppe richieste: riprova tra qualche istante." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let query: string;
  let userId: string;
  try {
    const body = await req.json();
    query = typeof body.query === "string" ? body.query.trim().slice(0, MAX_QUERY_LENGTH) : "";
    userId = typeof body.userId === "string" ? body.userId.slice(0, 100) : "";
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "Il campo 'query' è obbligatorio" }, { status: 400 });
  }

  try {
    const preferenceSummary = userId ? await getPreferenceSummary(userId) : null;
    const intent = await interpretQuery(query, preferenceSummary);
    let products = await searchProducts(intent.searchQuery, 20, { maxPrice: intent.maxPrice });

    // Se la query ottimizzata dall'AI non trova nulla, riprova con il testo originale
    // dell'utente: a volte una riformulazione troppo specifica non trova corrispondenze
    // su Google Shopping anche se il prodotto esiste davvero.
    if (products.length === 0 && intent.searchQuery.toLowerCase() !== query.toLowerCase()) {
      products = await searchProducts(query, 20, { maxPrice: intent.maxPrice });
    }

    const { items, summary, technicianTip } = await rankProducts(
      query,
      products,
      intent,
      preferenceSummary
    );

    const response: RecommendResponse = { query, items, summary, technicianTip };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
