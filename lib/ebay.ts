import { getCached, setCached } from "./cache";
import type { Product } from "./types";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

const TOKEN_TTL_MS = 60 * 60 * 1000; // cache 1h (token lasts ~2h)
const SEARCH_TTL_MS = 15 * 60 * 1000; // cache search results 15min

type EbayTokenResponse = {
  access_token: string;
  expires_in: number;
};

type EbayItemSummary = {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  image?: { imageUrl: string };
  itemWebUrl: string;
  condition?: string;
  shortDescription?: string;
};

type EbaySearchResponse = {
  itemSummaries?: EbayItemSummary[];
};

async function getAccessToken(): Promise<string> {
  const cached = await getCached<string>("ebay_token", TOKEN_TTL_MS);
  if (cached) return cached;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Credenziali eBay mancanti: imposta EBAY_CLIENT_ID e EBAY_CLIENT_SECRET in .env.local"
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    throw new Error(`Impossibile ottenere il token eBay (status ${res.status})`);
  }

  const data = (await res.json()) as EbayTokenResponse;
  await setCached("ebay_token", data.access_token);
  return data.access_token;
}

function normalizeItem(item: EbayItemSummary): Product | null {
  if (!item.price || !item.image?.imageUrl) return null;
  return {
    id: item.itemId,
    title: item.title,
    price: parseFloat(item.price.value),
    currency: item.price.currency,
    image: item.image.imageUrl,
    url: item.itemWebUrl,
    source: "eBay",
    condition: item.condition,
    specs: item.shortDescription
      ? item.shortDescription.split(/[.\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
      : undefined,
  };
}

export async function searchProducts(query: string, limit = 20): Promise<Product[]> {
  const cacheKey = `ebay_search_${query.toLowerCase()}_${limit}`;
  const cached = await getCached<Product[]>(cacheKey, SEARCH_TTL_MS);
  if (cached) return cached;

  const token = await getAccessToken();
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fieldgroups", "EXTENDED");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_IT",
    },
  });

  if (!res.ok) {
    throw new Error(`Ricerca eBay fallita (status ${res.status})`);
  }

  const data = (await res.json()) as EbaySearchResponse;
  const products = (data.itemSummaries ?? [])
    .map(normalizeItem)
    .filter((p): p is Product => p !== null);

  await setCached(cacheKey, products);
  return products;
}
