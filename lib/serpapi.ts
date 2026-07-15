import { getCached, setCached } from "./cache";
import type { Product } from "./types";

const SEARCH_URL = "https://serpapi.com/search.json";
const SEARCH_TTL_MS = 15 * 60 * 1000; // cache search results 15min

type SerpApiShoppingResult = {
  product_id?: string;
  position: number;
  title: string;
  link?: string;
  product_link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  snippet?: string;
};

type SerpApiResponse = {
  shopping_results?: SerpApiShoppingResult[];
  error?: string;
};

function normalizeItem(item: SerpApiShoppingResult): Product | null {
  const url = item.product_link ?? item.link;
  if (!item.extracted_price || !item.thumbnail || !url) return null;

  return {
    id: item.product_id ?? `${item.position}-${item.title}`,
    title: item.title,
    price: item.extracted_price,
    currency: "EUR",
    image: item.thumbnail,
    url,
    source: item.source ?? "Google Shopping",
    specs: item.snippet
      ? item.snippet.split(/[.\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
      : undefined,
  };
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  const cacheKey = `serpapi_search_${query.toLowerCase()}_${limit}`;
  const cached = await getCached<Product[]>(cacheKey, SEARCH_TTL_MS);
  if (cached) return cached;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("Chiave prodotti mancante: imposta SERPAPI_KEY in .env.local");
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", "it");
  url.searchParams.set("hl", "it");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Ricerca prodotti fallita (status ${res.status})`);
  }

  const data = (await res.json()) as SerpApiResponse;
  if (data.error) {
    throw new Error(`Ricerca prodotti fallita: ${data.error}`);
  }

  const products = (data.shopping_results ?? [])
    .slice(0, limit)
    .map(normalizeItem)
    .filter((p): p is Product => p !== null);

  await setCached(cacheKey, products);
  return products;
}
