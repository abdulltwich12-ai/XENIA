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
  old_price?: string;
  extracted_old_price?: number;
  thumbnail?: string;
  snippet?: string;
  second_hand_condition?: string;
};

type SerpApiResponse = {
  shopping_results?: SerpApiShoppingResult[];
  error?: string;
};

const USED_KEYWORDS = [
  "ricondizionat",
  "rigenerat",
  "usato",
  "usati",
  "refurbished",
  "renewed",
  "second hand",
  "seconda mano",
  "reso",
];

// Rileva se un prodotto è usato/ricondizionato dal titolo o dai metadati SerpApi,
// senza mai dedurre "Nuovo" quando l'informazione non è dichiarata esplicitamente
// (per non affermare qualcosa che non sappiamo con certezza).
function detectCondition(item: SerpApiShoppingResult): string | undefined {
  if (item.second_hand_condition) return item.second_hand_condition;
  const titleLower = item.title.toLowerCase();
  const match = USED_KEYWORDS.find((k) => titleLower.includes(k));
  return match ? "Usato/Ricondizionato (dichiarato nel titolo)" : undefined;
}

function normalizeItem(item: SerpApiShoppingResult): Product | null {
  const url = item.product_link ?? item.link;
  if (!item.extracted_price || !item.thumbnail || !url) return null;

  // Sconto reale solo se la fonte dati dichiara esplicitamente un prezzo pieno
  // più alto di quello attuale: non stimiamo o inventiamo mai uno sconto.
  const originalPrice =
    item.extracted_old_price && item.extracted_old_price > item.extracted_price
      ? item.extracted_old_price
      : undefined;

  return {
    id: item.product_id ?? `${item.position}-${item.title}`,
    title: item.title,
    price: item.extracted_price,
    currency: "EUR",
    image: item.thumbnail,
    url,
    source: item.source ?? "Google Shopping",
    condition: detectCondition(item),
    originalPrice,
    specs: item.snippet
      ? item.snippet
          .split(/[.\n]/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 4)
          .slice(0, 5)
      : undefined,
  };
}

export async function searchProducts(
  query: string,
  limit = 20,
  options: { maxPrice?: number | null } = {}
): Promise<Product[]> {
  const cacheKey = `serpapi_search_${query.toLowerCase()}_${limit}_${options.maxPrice ?? "any"}`;
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
  if (options.maxPrice != null) {
    url.searchParams.set("tbs", `mr:1,price:1,ppr_min:0,ppr_max:${options.maxPrice}`);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Ricerca prodotti fallita (status ${res.status})`);
  }

  const data = (await res.json()) as SerpApiResponse;
  if (data.error) {
    // "Nessun risultato" non è un errore applicativo: è un esito legittimo della ricerca.
    if (/no results/i.test(data.error)) {
      await setCached(cacheKey, []);
      return [];
    }
    throw new Error(`Ricerca prodotti fallita: ${data.error}`);
  }

  const products = (data.shopping_results ?? [])
    .slice(0, limit)
    .map(normalizeItem)
    .filter((p): p is Product => p !== null);

  await setCached(cacheKey, products);
  return products;
}
