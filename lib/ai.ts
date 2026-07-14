import type { Product, RankedProduct } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

type AiRankingItem = {
  id: string;
  score: number;
  reason: string;
  bestValue?: boolean;
};

type AiRankingResponse = {
  summary: string;
  ranking: AiRankingItem[];
};

function buildPrompt(query: string, products: Product[]): string {
  const catalog = products.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    currency: p.currency,
    condition: p.condition,
    specs: p.specs,
  }));

  return `Richiesta utente: "${query}"

Catalogo prodotti disponibili (JSON):
${JSON.stringify(catalog, null, 2)}

Analizza i prodotti sopra rispetto alla richiesta dell'utente. Rispondi SOLO con un JSON valido nel formato:
{
  "summary": "breve riassunto in italiano di cosa consigli e perché (2-3 frasi)",
  "ranking": [
    { "id": "<id prodotto>", "score": <numero 0-100>, "reason": "<breve spiegazione in italiano, max 1 frase>", "bestValue": <true solo per il miglior rapporto qualità/prezzo, al massimo un prodotto> }
  ]
}

Ordina "ranking" dal punteggio più alto al più basso. Includi solo i prodotti realmente rilevanti per la richiesta (puoi escluderne alcuni se non pertinenti). Non aggiungere testo fuori dal JSON.`;
}

export async function rankProducts(query: string, products: Product[]): Promise<{ items: RankedProduct[]; summary: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Chiave AI mancante: imposta GROQ_API_KEY in .env.local");
  }
  if (products.length === 0) {
    return { items: [], summary: "Nessun prodotto trovato per questa ricerca." };
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Sei un assistente esperto di elettronica di consumo che aiuta gli utenti italiani a scegliere il prodotto migliore in base a prezzo e caratteristiche. Rispondi sempre e solo con JSON valido, nel formato richiesto.",
        },
        { role: "user", content: buildPrompt(query, products) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Chiamata AI fallita (status ${res.status})`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Risposta AI vuota o malformata");
  }

  const parsed = JSON.parse(content) as AiRankingResponse;
  const productById = new Map(products.map((p) => [p.id, p]));

  const mapped: (RankedProduct | null)[] = parsed.ranking.map((r) => {
    const product = productById.get(r.id);
    if (!product) return null;
    const item: RankedProduct = {
      ...product,
      aiScore: r.score,
      aiReason: r.reason,
      bestValue: r.bestValue ?? false,
    };
    return item;
  });
  const items = mapped.filter((p): p is RankedProduct => p !== null);

  return { items, summary: parsed.summary };
}
