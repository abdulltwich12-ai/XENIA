import { getCached, setCached } from "./cache";
import type { Product } from "./types";

const SEARCH_URL = "https://serpapi.com/search.json";
const SEARCH_TTL_MS = 2 * 60 * 1000; // cache brevissima: solo per proteggere la quota gratuita SerpApi su ricerche identiche ravvicinate

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isEmptyResultError(error: string): boolean {
  return /no results|any results|hasn'?t returned/i.test(error);
}

// Google Shopping a volte risponde "nessun risultato" in modo transitorio anche per query
// perfettamente valide (osservato ripetutamente su termini generici come "RAM DDR5",
// "processore Intel LGA1700", ecc.): un secondo tentativo pochi istanti dopo spesso trova
// risultati normalmente. Stesso principio di resilienza già applicato alle chiamate Gemini
// in lib/ai.ts, qui applicato all'esito "vuoto" invece che a un codice di errore HTTP.
const MAX_EMPTY_RETRIES = 2;
const EMPTY_RETRY_DELAY_MS = 500;

async function fetchShoppingResults(url: URL): Promise<SerpApiResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Ricerca prodotti fallita (status ${res.status})`);
  }
  return (await res.json()) as SerpApiResponse;
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

  let data: SerpApiResponse = {};
  for (let attempt = 1; attempt <= MAX_EMPTY_RETRIES + 1; attempt++) {
    data = await fetchShoppingResults(url);

    if (!data.error) break; // risultati reali (anche se l'array è vuoto per davvero)

    if (!isEmptyResultError(data.error)) {
      throw new Error(`Ricerca prodotti fallita: ${data.error}`);
    }
    if (attempt <= MAX_EMPTY_RETRIES) {
      await sleep(EMPTY_RETRY_DELAY_MS * attempt);
    }
  }

  if (data.error) {
    // Dopo tutti i tentativi resta vuoto: accettiamo che sia un esito reale. Non lo mettiamo
    // in cache, cosi una prossima richiesta (utente diverso o stessa persona poco dopo) parte
    // da un tentativo fresco invece di ereditare un vuoto che potrebbe non ripetersi.
    return [];
  }

  const products = (data.shopping_results ?? [])
    .slice(0, limit)
    .map(normalizeItem)
    .filter((p): p is Product => p !== null);

  await setCached(cacheKey, products);
  return products;
}

// Oltre alla flakiness transitoria (gestita dai retry sopra), abbiamo osservato che una query
// ESATTA ripetuta molte volte in poco tempo può restare "bloccata" su risultati vuoti da parte
// di Google Shopping, anche quando una formulazione diversa della stessa ricerca funziona
// normalmente (verificato: bastano poche decine di ripetizioni ravvicinate). Per le categorie
// con query fissa (non derivate da un testo utente, quindi ripetute identiche ad ogni richiesta
// di ogni utente) usiamo un pool di formulazioni equivalenti scelte a rotazione casuale, invece
// di una singola coppia primaria/riserva: così anche con molto traffico nessuna singola stringa
// viene martellata abbastanza da rischiare la stessa sorte.
export async function searchProductsFromPool(
  queries: string[],
  limit = 20,
  options: { maxPrice?: number | null } = {}
): Promise<Product[]> {
  const start = Math.floor(Math.random() * queries.length);
  for (let i = 0; i < queries.length; i++) {
    const query = queries[(start + i) % queries.length];
    const results = await searchProducts(query, limit, options);
    if (results.length > 0) return results;
  }
  return [];
}
