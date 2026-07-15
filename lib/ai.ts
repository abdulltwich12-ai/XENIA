import type { Product, RankedProduct } from "./types";

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
  technicianTip: string | null;
  requestIsImpossible: boolean;
  ranking: AiRankingItem[];
};

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAiJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chiave AI mancante: imposta GEMINI_API_KEY in .env.local");
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error("Risposta AI vuota o malformata");
      }
      return JSON.parse(content);
    }

    // Il modello gratuito Gemini a volte è temporaneamente sovraccarico (503) o
    // rate-limited (429): sono errori transitori, ha senso ritentare brevemente
    // prima di arrendersi, invece di far fallire subito la ricerca dell'utente.
    if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
      lastError = new Error(`Chiamata AI fallita (status ${res.status})`);
      await sleep(attempt * 500);
      continue;
    }

    throw new Error(`Chiamata AI fallita (status ${res.status})`);
  }

  throw lastError ?? new Error("Chiamata AI fallita");
}

export async function interpretQuery(
  query: string,
  preferenceSummary?: string | null
): Promise<QueryIntent> {
  const prompt = `Richiesta dell'utente: "${query}"
${preferenceSummary ? `\nPreferenze note di questo utente da ricerche passate: ${preferenceSummary}\n` : ""}
Analizza questa richiesta di acquisto di un prodotto elettronico da un punto di vista tecnico e rispondi SOLO con un JSON valido nel formato:
{
  "searchQuery": "<poche parole chiave in italiano, ottimizzate per un motore di ricerca shopping, senza frasi discorsive>",
  "maxPrice": <budget massimo in euro come numero se l'utente lo specifica o lo lascia intendere con un numero (es. 'sotto i 50 euro' -> 50), altrimenti null>,
  "mustHaveFeatures": ["<eventuali caratteristiche irrinunciabili menzionate o tecnicamente implicite dalla richiesta, es. 'impermeabile', 'cancellazione del rumore', 'USB 3.0'>"]
}

Ricorda: PC, schede video e altri componenti anche molto costosi (es. 2000€ o più) o con specifiche molto alte sono prodotti reali ed esistenti, non impossibili: cerca sempre di tradurli in una query di ricerca sensata, non scartarli.

Importante su modelli/generazioni specifiche: NON inserire in "searchQuery" un modello o una generazione precisa di componente (es. "RTX 4070", "i9-14900K") a meno che sia l'utente stesso a averlo nominato esplicitamente. La tua conoscenza dei modelli più recenti può essere superata: se generalizzi da sola rischi di far cercare solo componenti datati e di escludere modelli più nuovi appena usciti che i negozi vendono già. Per richieste generiche (es. "scheda video potente", "pc gaming da 2000 euro") usa parole chiave per categoria/fascia/uso ("scheda video gaming fascia alta", "pc gaming 2000 euro RTX"), MAI un numero di modello preciso: lascia che sia la ricerca live a mostrare cosa esiste davvero oggi sul mercato, generazione più recente inclusa.

Se la richiesta riguarda streaming/dirette su piattaforme come Twitch, Kick, TikTok Live, YouTube Live o simili, traduci l'esigenza nella categoria di prodotto tecnicamente corretta: webcam (per es. "webcam streaming 1080p"), microfono USB/XLR per streaming, capture card per catturare da console/fotocamera, luce ad anello o softbox per videocamera, braccio da scrivania per microfono, scheda audio esterna, PC o componenti per streaming (CPU/GPU capaci di incoraggiare gioco+encoding contemporaneamente). Scegli la categoria più adatta in base a cosa l'utente descrive (es. "voglio migliorare l'audio delle mie dirette" -> microfono, non webcam; "pc per giocare e fare live insieme" -> PC con specifiche adatte a gioco+streaming).

Usa le preferenze passate solo come contesto leggero (es. per scegliere parole chiave più affini ai suoi gusti), non sovrascrivere mai quello che l'utente chiede esplicitamente ora. Non inventare un budget se l'utente non lo suggerisce nemmeno indirettamente. Non aggiungere testo fuori dal JSON.`;

  const parsed = (await callAiJson(
    "Sei un tecnico informatico esperto (hardware PC, componenti, periferiche) e conosci bene il mondo dello streaming su Twitch, Kick, TikTok e YouTube (webcam, microfoni, capture card, luci, PC per gioco+streaming). Traduci richieste in linguaggio naturale in query di ricerca shopping tecnicamente precise, in italiano. Rispondi sempre e solo con JSON valido.",
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
    originalPrice: p.originalPrice, // presente solo se la fonte dati dichiara uno sconto reale
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

Analizza i prodotti sopra come farebbe un tecnico informatico esperto rispetto alla richiesta dell'utente, rispettando budget e caratteristiche irrinunciabili quando indicati. Rispondi SOLO con un JSON valido nel formato:
{
  "summary": "breve riassunto in italiano di cosa consigli e perché, spiegando la scelta fatta (2-3 frasi)",
  "technicianTip": "<un consiglio tecnico breve (1-2 frasi) in italiano, o null se non hai nulla di utile da aggiungere>",
  "requestIsImpossible": <true SOLO se la richiesta descrive specifiche tecnicamente impossibili per qualunque prodotto reale (es. una velocità/capacità/prestazione ben oltre ciò che la tecnologia attuale può fare) e quindi NESSUN prodotto può davvero soddisfarla, anche se nel catalogo ci sono prodotti simili o della stessa categoria generale; altrimenti false>,
  "ranking": [
    { "id": "<id prodotto>", "score": <numero 0-100>, "reason": "<breve spiegazione in italiano, max 1 frase>", "bestValue": <true solo per il miglior rapporto qualità/prezzo, al massimo un prodotto> }
  ]
}

IMPORTANTE su "requestIsImpossible": se true, il sistema ignorerà comunque qualunque cosa scrivi in "ranking" e non mostrerà nessun prodotto all'utente, quindi non ha senso includere prodotti in "ranking" in quel caso (lascialo vuoto). Esempio: richiesta "processore a 900 GHz" → nessun processore reale ci arriva nemmeno lontanamente (i processori attuali sono nell'ordine dei 3-6 GHz) → "requestIsImpossible": true, "ranking": [], anche se il catalogo contiene processori veri e potenti. Un budget basso, un prodotto raro/costoso, o una richiesta generica NON sono impossibili: in quei casi "requestIsImpossible" resta false.

Caso intermedio importante — richieste "borderline" (numericamente estreme ma non impossibili in assoluto, es. "2000 FPS", "download a 10 Gbps"): qui "requestIsImpossible" resta false e mostri comunque i prodotti migliori, MA hai l'obbligo di usare "technicianTip" per spiegare chiaramente e in modo concreto perché quel numero non è realistico come aspettativa generale (es. "2000 FPS è raggiungibile solo in giochi molto leggeri a bassa risoluzione con hardware di fascia altissima; nella maggior parte dei giochi moderni a risoluzioni comuni non lo vedrai mai"). Non lasciare questa informazione solo accennata nel "summary": deve essere il contenuto principale di "technicianTip" quando la richiesta ha un target numerico ambizioso, con priorità su qualunque altro consiglio tecnico generico.

Il campo "technicianTip" è dove ragioni da tecnico, non da semplice comparatore di prezzi. Usalo prima di tutto per la spiegazione di cui sopra quando pertinente; altrimenti per, ad esempio: segnalare quando conviene spendere qualcosa in più per una variante nel catalogo con una caratteristica tecnica migliore (es. "il modello Y costa 8€ in più ma ha USB 3.0 invece di 2.0, utile se trasferisci file spesso"); avvisare di un limite tecnico comune alla categoria (es. "i microfoni USB integrati nelle webcam economiche in genere sono deboli: se l'audio conta molto valuta un microfono dedicato"); o dare un criterio pratico di scelta legato all'uso che l'utente ha descritto. Basa i confronti tra prodotti SOLO sui dati del catalogo sopra; le considerazioni tecniche generali di settore (non specifiche di un singolo prodotto) sono ammesse anche se non scritte nel catalogo, purché siano nozioni tecniche comuni e non inventate. Se non hai un consiglio tecnico genuino da dare, usa null: meglio nessun consiglio che uno forzato o banale.

Regole per non trarre in inganno l'utente (fondamentali):
- Basati SOLO su titolo, prezzo e specifiche presenti nel catalogo qui sopra. Non inventare caratteristiche tecniche, certificazioni, materiali o prestazioni che non sono esplicitamente scritte nei dati forniti.
- Se non hai abbastanza informazioni per valutare un aspetto (es. qualità audio, durata batteria) non affermarlo come fatto: ometti quell'aspetto o segnala l'incertezza (es. "non specificato nella scheda").
- Non usare superlativi assoluti ("il migliore in assoluto", "perfetto") se non giustificati dai dati: resta descrittivo e onesto sui limiti del confronto (i dati vengono da un solo motore di ricerca prodotti, i prezzi possono cambiare).
- "bestValue": true va assegnato al massimo a UN prodotto in tutto l'elenco, solo se il vantaggio prezzo/caratteristiche è realmente evidente dai dati (es. prezzo più basso a parità di caratteristiche rilevanti, oppure "originalPrice" indica uno sconto reale). Non serve che sia il più economico in assoluto se altri non sono pertinenti alla richiesta.
- Se nel catalogo compaiono più generazioni/modelli dello stesso tipo di componente (es. sia GPU/CPU più vecchie che più recenti), a parità di pertinenza con la richiesta e di budget preferisci nel punteggio quelle di generazione più recente: sono dati reali appena trovati dalla ricerca, quindi rifletti cosa esiste davvero oggi sul mercato invece di favorire per abitudine i modelli che conosci meglio.
- L'elenco finale che l'utente vedrà sarà comunque riordinato per prezzo crescente da parte del sito, indipendentemente dall'ordine che scrivi in "ranking": il tuo compito qui è scegliere QUALI prodotti includere (scartando quelli non pertinenti, fuori budget o senza le caratteristiche richieste) e dare punteggio/motivazione/bestValue corretti, non decidere l'ordine di visualizzazione.

Escludi i prodotti che superano chiaramente il budget indicato o che non hanno le caratteristiche irrinunciabili, se specificate. Le preferenze passate (se presenti) sono solo un aiuto per spareggiare tra opzioni simili, non devono mai prevalere sulla richiesta esplicita attuale. Includi solo i prodotti realmente rilevanti per la richiesta (es. escludi accessori o modelli diversi da quello cercato). Se la richiesta descrive specifiche tecnicamente impossibili e NESSUN prodotto nel catalogo le soddisfa realmente, lascia "ranking" vuoto e scrivi in "summary" una frase sola, onesta e diretta, che lo spiega (es. "Nessun prodotto reale raggiunge questa specifica: i risultati trovati sono solo genericamente simili, non corrispondono davvero a quanto richiesto."): non forzare un consiglio pur di dare una risposta. Non aggiungere testo fuori dal JSON.`;
}

export async function rankProducts(
  query: string,
  products: Product[],
  intent: QueryIntent,
  preferenceSummary?: string | null
): Promise<{ items: RankedProduct[]; summary: string; technicianTip: string | null }> {
  if (products.length === 0) {
    return { items: [], summary: "Nessun prodotto trovato per questa ricerca.", technicianTip: null };
  }

  const parsed = (await callAiJson(
    "Sei un tecnico informatico esperto che aiuta gli utenti italiani a scegliere il prodotto elettronico migliore in base a prezzo, budget, caratteristiche richieste e buon senso tecnico (incluse esigenze di streaming su Twitch, Kick, TikTok, YouTube). Sei rigoroso e onesto: non inventi mai dettagli non presenti nei dati forniti e non esageri le qualità di un prodotto, ma sai anche dare consigli tecnici pratici come farebbe un tecnico esperto in negozio. Rispondi sempre e solo con JSON valido, nel formato richiesto.",
    buildRankingPrompt(query, products, intent, preferenceSummary)
  )) as AiRankingResponse;

  // Enforcement lato codice, non solo lato prompt: se l'AI segnala la richiesta come
  // impossibile, ignoriamo qualunque prodotto abbia comunque messo in "ranking" per errore.
  // Non ci affidiamo al solo prompt perché un modello può violare l'istruzione.
  if (parsed.requestIsImpossible) {
    return {
      items: [],
      summary: parsed.summary,
      technicianTip: parsed.technicianTip ?? null,
    };
  }

  const productById = new Map(products.map((p) => [p.id, p]));

  const mapped: (RankedProduct | null)[] = parsed.ranking.map((r) => {
    const product = productById.get(r.id);
    if (!product) return null;
    const item: RankedProduct = {
      ...product,
      aiScore: Math.max(0, Math.min(100, Math.round(r.score))),
      aiReason: r.reason,
      bestValue: r.bestValue ?? false,
    };
    return item;
  });
  let items = mapped.filter((p): p is RankedProduct => p !== null);

  // Garantisce al massimo un "bestValue" anche se l'AI ne segnala più di uno per errore:
  // tiene solo quello con il punteggio più alto tra i candidati.
  const bestValueCandidates = items.filter((i) => i.bestValue);
  if (bestValueCandidates.length > 1) {
    const topId = bestValueCandidates.sort((a, b) => b.aiScore - a.aiScore)[0].id;
    items = items.map((i) => (i.id === topId ? i : { ...i, bestValue: false }));
  }

  // Ordine finale sempre per prezzo crescente: è un fatto verificabile (il prezzo reale
  // restituito dalla ricerca), non un giudizio dell'AI che potrebbe nascondere l'opzione più economica.
  items = items.sort((a, b) => a.price - b.price);

  return { items, summary: parsed.summary, technicianTip: parsed.technicianTip ?? null };
}
