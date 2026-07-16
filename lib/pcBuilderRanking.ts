import type { Product, RankedProduct } from "./types";
import { rankCompatibleParts } from "./ai";

// Pattern condiviso per tutte le categorie del PC builder con un vincolo di compatibilità
// rigido e verificabile (scheda madre, dissipatore, case): rileva un dato tecnico reale dal
// titolo/specs di ogni prodotto, manda in classifica AI SOLO quelli per cui il dato è certo,
// e allega in coda quelli non determinabili con un avviso — mai un giudizio di compatibilità
// lasciato all'AI, e mai un prodotto scartato del tutto solo perché non verificabile.
export async function rankWithDetection<T>(
  label: string,
  products: Product[],
  detect: (p: Product) => T | null,
  undetectedReason: string
): Promise<{
  items: (RankedProduct & { meta: T | null })[];
  summary: string;
  technicianTip: string | null;
}> {
  const detected: { product: Product; meta: T }[] = [];
  const undetected: Product[] = [];
  for (const p of products) {
    const meta = detect(p);
    if (meta !== null) detected.push({ product: p, meta });
    else undetected.push(p);
  }

  const {
    items: rankedDetected,
    summary,
    technicianTip,
  } = await rankCompatibleParts(
    label,
    detected.map((d) => d.product)
  );

  const metaById = new Map(detected.map((d) => [d.product.id, d.meta]));
  const rankedOptions = rankedDetected.map((item) => ({
    ...item,
    meta: metaById.get(item.id) ?? null,
  }));

  const undetectedOptions = undetected
    .sort((a, b) => a.price - b.price)
    .map((product) => ({
      ...product,
      aiScore: 0,
      aiReason: undetectedReason,
      bestValue: false,
      meta: null as T | null,
    }));

  const finalSummary =
    products.length === 0
      ? "Nessun prodotto trovato per questa ricerca."
      : rankedOptions.length === 0
        ? "Non è stato possibile confermare automaticamente la compatibilità di nessun prodotto trovato: controlla manualmente le opzioni qui sotto."
        : summary;

  return {
    items: [...rankedOptions, ...undetectedOptions],
    summary: finalSummary,
    technicianTip,
  };
}
