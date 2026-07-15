import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/serpapi";
import { interpretQuery, rankProducts } from "@/lib/ai";
import { getPreferenceSummary } from "@/lib/preferences";
import type { RecommendResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  let query: string;
  let userId: string;
  try {
    const body = await req.json();
    query = typeof body.query === "string" ? body.query.trim() : "";
    userId = typeof body.userId === "string" ? body.userId : "";
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "Il campo 'query' è obbligatorio" }, { status: 400 });
  }

  try {
    const preferenceSummary = userId ? await getPreferenceSummary(userId) : null;
    const intent = await interpretQuery(query, preferenceSummary);
    const products = await searchProducts(intent.searchQuery, 20, { maxPrice: intent.maxPrice });
    const { items, summary } = await rankProducts(query, products, intent, preferenceSummary);

    const response: RecommendResponse = { query, items, summary };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
