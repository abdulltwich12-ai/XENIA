export type Product = {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string;
  url: string;
  source: string;
  condition?: string;
  specs?: string[];
  /** Prezzo pieno prima dello sconto, solo se dichiarato dalla fonte dati (mai stimato). */
  originalPrice?: number;
};

export type RankedProduct = Product & {
  aiScore: number;
  aiReason: string;
  bestValue?: boolean;
};

export type RecommendResponse = {
  query: string;
  items: RankedProduct[];
  summary: string;
  technicianTip: string | null;
};
