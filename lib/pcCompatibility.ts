import type { Product } from "./types";

export type Socket = "AM5" | "AM4" | "LGA1851" | "LGA1700" | "LGA1200";
export type RamType = "DDR4" | "DDR5";

export type MotherboardPlatform = {
  socket: Socket;
  ramType: RamType;
  chipset: string;
  formFactor?: string;
  /** true se il tipo di RAM è stato dedotto da una convenzione di mercato (nessuna variante
   * DDR4 esplicitamente indicata su un chipset dove quella variante è sempre marcata), non
   * letto esplicitamente dal titolo. Va segnalato in UI, non presentato come dato certo al 100%. */
  ramTypeInferred?: boolean;
};

// Tabella di riferimento chipset -> piattaforma. Conoscenza hardware stabile (i chipset non
// cambiano socket/RAM dopo il lancio), ma va aggiornata a mano quando escono nuove
// generazioni non ancora presenti qui. "ramType: null" = il chipset supporta sia DDR4 che
// DDR5 a seconda della scheda specifica: va rilevato dal titolo. "defaultRamType" è impostato
// SOLO sui chipset dove il mercato marca sempre esplicitamente la variante minoritaria (es. i
// produttori scrivono sempre "D4"/"DDR4" sulle Z790/B760 DDR4, mai il contrario): se il titolo
// non menziona affatto DDR4/DDR5, si può dedurre con buona affidabilità il default. Sui chipset
// più vecchi (600 series, lanciati quando DDR4 era ancora molto comune) questa convenzione non
// è altrettanto affidabile: lì resta "ramType: null" senza default, va sempre verificato.
const CHIPSET_PLATFORM: Record<
  string,
  { socket: Socket; ramType: RamType | null; defaultRamType?: RamType }
> = {
  // AMD AM5 - solo DDR5
  A620: { socket: "AM5", ramType: "DDR5" },
  B650: { socket: "AM5", ramType: "DDR5" },
  B650E: { socket: "AM5", ramType: "DDR5" },
  X670: { socket: "AM5", ramType: "DDR5" },
  X670E: { socket: "AM5", ramType: "DDR5" },
  B840: { socket: "AM5", ramType: "DDR5" },
  B850: { socket: "AM5", ramType: "DDR5" },
  X870: { socket: "AM5", ramType: "DDR5" },
  X870E: { socket: "AM5", ramType: "DDR5" },

  // AMD AM4 - solo DDR4
  A320: { socket: "AM4", ramType: "DDR4" },
  B350: { socket: "AM4", ramType: "DDR4" },
  X370: { socket: "AM4", ramType: "DDR4" },
  B450: { socket: "AM4", ramType: "DDR4" },
  X470: { socket: "AM4", ramType: "DDR4" },
  B550: { socket: "AM4", ramType: "DDR4" },
  X570: { socket: "AM4", ramType: "DDR4" },

  // Intel LGA1851 (Core Ultra 200S / Arrow Lake) - solo DDR5
  Z890: { socket: "LGA1851", ramType: "DDR5" },
  B860: { socket: "LGA1851", ramType: "DDR5" },
  H810: { socket: "LGA1851", ramType: "DDR5" },

  // Intel LGA1700 600 series (12a gen, 2021) - DDR4 ancora molto comune al lancio: nessun
  // default sicuro, va sempre rilevato esplicitamente dal titolo.
  H610: { socket: "LGA1700", ramType: null },
  B660: { socket: "LGA1700", ramType: null },
  H670: { socket: "LGA1700", ramType: null },
  Z690: { socket: "LGA1700", ramType: null },

  // Intel LGA1700 700 series (13a/14a gen, 2022+) - DDR5 è ormai lo standard di mercato: le
  // varianti DDR4 vengono sempre marcate esplicitamente ("D4"/"DDR4") dai produttori proprio
  // perché sono l'eccezione pensata per riusare RAM esistente, quindi se il titolo non dice
  // nulla è affidabile dedurre DDR5.
  B760: { socket: "LGA1700", ramType: null, defaultRamType: "DDR5" },
  H770: { socket: "LGA1700", ramType: null, defaultRamType: "DDR5" },
  Z790: { socket: "LGA1700", ramType: null, defaultRamType: "DDR5" },

  // Intel LGA1200 (10a/11a gen) - solo DDR4
  H410: { socket: "LGA1200", ramType: "DDR4" },
  B460: { socket: "LGA1200", ramType: "DDR4" },
  H470: { socket: "LGA1200", ramType: "DDR4" },
  Z490: { socket: "LGA1200", ramType: "DDR4" },
  H510: { socket: "LGA1200", ramType: "DDR4" },
  B560: { socket: "LGA1200", ramType: "DDR4" },
  Z590: { socket: "LGA1200", ramType: "DDR4" },
};

const FORM_FACTOR_PATTERNS: [RegExp, string][] = [
  [/mini[\s-]?itx/i, "Mini-ITX"],
  [/micro[\s-]?atx|m[\s-]?atx/i, "Micro-ATX"],
  [/e-?atx/i, "E-ATX"],
  [/\batx\b/i, "ATX"],
];

function detectFormFactor(title: string): string | undefined {
  for (const [pattern, label] of FORM_FACTOR_PATTERNS) {
    if (pattern.test(title)) return label;
  }
  return undefined;
}

// Gerarchia dei formati, dal più piccolo al più grande: un case pensato per un formato
// grande ospita fisicamente anche le schede madri di formato uguale o più piccolo (gli
// standard di foratura sono un sovrainsieme), mai il contrario.
const FORM_FACTOR_ORDER = ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"];

export function detectCaseFormFactor(product: Product): string | undefined {
  return detectFormFactor(product.title);
}

export function isCaseCompatibleWithMotherboard(
  caseFormFactor: string,
  motherboardFormFactor: string
): boolean {
  const caseIndex = FORM_FACTOR_ORDER.indexOf(caseFormFactor);
  const moboIndex = FORM_FACTOR_ORDER.indexOf(motherboardFormFactor);
  if (caseIndex === -1 || moboIndex === -1) return false;
  return caseIndex >= moboIndex;
}

export function detectMotherboardPlatform(product: Product): MotherboardPlatform | null {
  const title = product.title.toUpperCase();

  const chipsetMatch = Object.keys(CHIPSET_PLATFORM).find((chipset) => {
    // \b non basta da solo per codici come "B650" seguiti da lettere (es. B650E): controlliamo
    // che non sia preceduto da altre lettere/cifre, ma permettiamo suffissi (B650E, B650-A, ecc.)
    const re = new RegExp(`(?<![A-Z0-9])${chipset}(?![0-9])`);
    return re.test(title);
  });

  if (!chipsetMatch) return null;

  const platform = CHIPSET_PLATFORM[chipsetMatch];
  let ramType = platform.ramType;
  let ramTypeInferred = false;

  if (!ramType) {
    // "D4"/"D5" sono abbreviazioni commerciali comuni (es. Asus "PRIME Z790-P D4") per
    // indicare la variante DDR4/DDR5 della stessa scheda: le trattiamo come DDR4/DDR5 esplicite.
    if (/DDR5|(?<![A-Z0-9])D5(?![A-Z0-9])/i.test(title)) ramType = "DDR5";
    else if (/DDR4|(?<![A-Z0-9])D4(?![A-Z0-9])/i.test(title)) ramType = "DDR4";
    else if (platform.defaultRamType) {
      // Nessuna menzione esplicita, ma su questo chipset i produttori marcano sempre la
      // variante minoritaria: deduciamo il default di mercato, segnalandolo come dedotto.
      ramType = platform.defaultRamType;
      ramTypeInferred = true;
    } else {
      return null; // chipset ambiguo e nessun default affidabile: non rischiamo
    }
  }

  return {
    socket: platform.socket,
    ramType,
    chipset: chipsetMatch,
    formFactor: detectFormFactor(product.title),
    ramTypeInferred,
  };
}

// Pattern su nomi modello reali. Ordine rilevante: dal più specifico/recente al più generico,
// per evitare che una sottostringa di un pattern successivo interferisca.
const CPU_SOCKET_PATTERNS: [RegExp, Socket][] = [
  [/core\s*ultra\s*[3579]\s*2\d{2}/i, "LGA1851"], // Core Ultra 200 series (Arrow Lake desktop)
  [/ryzen\s*[3579]\s*9\d{3}/i, "AM5"], // Ryzen 9000 series
  [/ryzen\s*[3579]\s*8\d{3}g/i, "AM5"], // Ryzen 8000G (APU desktop)
  [/ryzen\s*[3579]\s*7\d{3}/i, "AM5"], // Ryzen 7000 series
  [/ryzen\s*[3579]\s*5\d{3}/i, "AM4"], // Ryzen 5000 series desktop
  [/i[3579]-1[234]\d{2,3}/i, "LGA1700"], // Intel 12a/13a/14a gen (12xxx-14xxx)
  [/i[3579]-1[01]\d{2,3}/i, "LGA1200"], // Intel 10a/11a gen
];

export function detectCpuSocket(product: Product): Socket | null {
  const text = `${product.title} ${(product.specs ?? []).join(" ")}`;
  for (const [pattern, socket] of CPU_SOCKET_PATTERNS) {
    if (pattern.test(text)) return socket;
  }
  return null;
}

export function detectRamType(product: Product): RamType | null {
  const text = `${product.title} ${(product.specs ?? []).join(" ")}`;
  if (/DDR5/i.test(text)) return "DDR5";
  if (/DDR4/i.test(text)) return "DDR4";
  return null;
}

// SO-DIMM è il formato per portatili: fisicamente non entra negli slot DIMM standard di una
// scheda madre desktop, anche se il tipo di memoria (DDR4/DDR5) corrisponde. Va sempre escluso
// dai risultati per un PC desktop, indipendentemente dalla generazione DDR.
export function isLaptopMemoryFormFactor(product: Product): boolean {
  const text = `${product.title} ${(product.specs ?? []).join(" ")}`;
  return /so-?dimm|per\s+(notebook|portatile|laptop)/i.test(text);
}

const ALL_SOCKETS: Socket[] = ["AM5", "AM4", "LGA1851", "LGA1700", "LGA1200"];

// I dissipatori CPU elencano quasi sempre esplicitamente tutti i socket supportati
// (spesso più di uno): cerchiamo ogni socket noto nel titolo/specs e raccogliamo i match.
export function detectCoolerSockets(product: Product): Socket[] | null {
  const text = `${product.title} ${(product.specs ?? []).join(" ")}`.toUpperCase();
  const found = ALL_SOCKETS.filter((socket) => text.includes(socket));
  return found.length > 0 ? found : null;
}

export function detectCoolerType(product: Product): "aria" | "liquido" {
  const text = `${product.title} ${(product.specs ?? []).join(" ")}`;
  const isLiquid = /\baio\b|liquid|a\s+liquido|radiatore|\b(120|140|240|280|360|420)\s*mm\b/i.test(
    text
  );
  return isLiquid ? "liquido" : "aria";
}

// Solo informativo per un badge: non usato per escludere alimentatori, perché la potenza
// realmente necessaria dipende da troppi fattori per un calcolo affidabile dal solo titolo.
export function detectPsuWattage(product: Product): number | null {
  const text = `${product.title} ${(product.specs ?? []).join(" ")}`;
  const match = text.match(/\b(\d{3,4})\s*w(?:att)?\b/i);
  if (!match) return null;
  const watts = parseInt(match[1], 10);
  return watts >= 200 && watts <= 2000 ? watts : null;
}

const SOCKET_SEARCH_TERMS: Record<Socket, string> = {
  AM5: "processore AMD Ryzen AM5",
  AM4: "processore AMD Ryzen AM4",
  LGA1851: "processore Intel Core Ultra 200 LGA1851",
  LGA1700: "processore Intel LGA1700",
  LGA1200: "processore Intel LGA1200",
};

export function socketSearchTerms(socket: Socket): string {
  return SOCKET_SEARCH_TERMS[socket];
}

export const SOCKET_LABELS: Record<Socket, string> = {
  AM5: "AMD AM5",
  AM4: "AMD AM4",
  LGA1851: "Intel LGA1851",
  LGA1700: "Intel LGA1700",
  LGA1200: "Intel LGA1200",
};
