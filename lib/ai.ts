import type { Product, RankedProduct } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export type QueryIntent = {
  searchQuery: string;
  maxPrice: number | null;
  mustHaveFeatures: string[];
};

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

async function callGroqJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Chiave AI mancante: imposta GROQ_API_KEY in .env.local");
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
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
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

  return JSON.parse(content);
}

export async function interpretQuery(
  query: string,
  preferenceSummary?: string | null
): Promise<QueryIntent> {
  const prompt = `Richiesta dell'utente: "${query}"
${preferenceSummary ? `\nPreferenze note di questo utente da ricerche passate: ${preferenceSummary}\n` : ""}
Analizza questa richiesta di acquisto di un prodotto elettronico e rispondi SOLO con un JSON valido nel formato:
{
  "searchQuery": "<poche parole chiave in italiano, ottimizzate per un motore di ricerca shopping, senza frasi discorsive>",
  "maxPrice": <budget massimo in euro come numero se l'utente lo specifica o lo lascia intendere con un numero (es. 'sotto i 50 euro' -> 50), altrimenti null>,
  "mustHaveFeatures": ["<eventuali caratteristiche irrinunciabili menzionate dall'utente, es. 'impermeabile', 'cancellazione del rumore'>"]
}

Usa le preferenze passate solo come contesto leggero (es. per scegliere parole chiave più affini ai suoi gusti), non sovrascrivere mai quello che l'utente chiede esplicitamente ora. Non inventare un budget se l'utente non lo suggerisce nemmeno indirettamente. Non aggiungere testo fuori dal JSON.`;

  const parsed = (await callGroqJson(
    "Sei un assistente che traduce richieste in linguaggio naturale in query di ricerca shopping efficaci, in italiano. Rispondi sempre e solo con JSON valido.",
    prompt
  )) as QueryIntent;

  return {
    searchQuery: parsed.searchQuery?.trim() || query,
    maxPrice: typeof parsed.maxPrice === "number" ? parsed.maxPrice : null,
    mustHaveFeatures: Array.isArray(parsed.mustHaveFeatures) ? parsed.mustHaveFeatures : [],
  };
}

function buildRankingPrompt(
  query: string,
  products: Product[],
  intent: QueryIntent,
  preferenceSummary?: string | null
): string {
  const catalog = products.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    currency: p.currency,
    condition: p.condition,
    specs: p.specs,
  }));

  const constraints = [
    intent.maxPrice != null ? `Budget massimo indicato dall'utente: ${intent.maxPrice} EUR.` : null,
    intent.mustHaveFeatures.length > 0
      ? `Caratteristiche irrinunciabili: ${intent.mustHaveFeatures.join(", ")}.`
      : null,
    preferenceSummary ? `Preferenze note da ricerche passate: ${preferenceSummary}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `Richiesta utente originale: "${query}"
${constraints ? `\n${constraints}\n` : ""}
Catalogo prodotti disponibili (JSON):
${JSON.stringify(catalog, null, 2)}

Analizza i prodotti sopra rispetto alla richiesta dell'utente, rispettando budget e caratteristiche irrinunciabili quando indicati. Rispondi SOLO con un JSON valido nel formato:
{
  "summary": "breve riassunto in italiano di cosa consigli e perché (2-3 frasi)",
  "ranking": [
    { "id": "<id prodotto>", "score": <numero 0-100>, "reason": "<breve spiegazione in italiano, max 1 frase>", "bestValue": <true solo per il miglior rapporto qualità/prezzo, al massimo un prodotto> }
  ]
}

Ordina "ranking" dal punteggio più alto al più basso. Escludi i prodotti che superano chiaramente il budget indicato o che non hanno le caratteristiche irrinunciabili, se specificate. Le preferenze passate (se presenti) sono solo un aiuto per spareggiare tra opzioni simili, non devono mai prevalere sulla richiesta esplicita attuale. Includi solo i prodotti realmente rilevanti per la richiesta. Non aggiungere testo fuori dal JSON.`;
}

export async function rankProducts(
  query: string,
  products: Product[],
  intent: QueryIntent,
  preferenceSummary?: string | null
): Promise<{ items: RankedProduct[]; summary: string }> {
  if (products.length === 0) {
    return { items: [], summary: "Nessun prodotto trovato per questa ricerca." };
  }

  const parsed = (await callGroqJson(
    "Sei un assistente esperto di elettronica di consumo che aiuta gli utenti italiani a scegliere il prodotto migliore in base a prezzo, budget e caratteristiche richieste. Rispondi sempre e solo con JSON valido, nel formato richiesto.",
    buildRankingPrompt(query, products, intent, preferenceSummary)
  )) as AiRankingResponse;

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
