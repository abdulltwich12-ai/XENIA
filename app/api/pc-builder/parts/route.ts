import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/serpapi";
import { rankCompatibleParts } from "@/lib/ai";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { rankWithDetection } from "@/lib/pcBuilderRanking";
import {
  detectCaseFormFactor,
  detectCoolerSockets,
  detectCoolerType,
  detectCpuSocket,
  detectPsuWattage,
  detectRamType,
  isCaseCompatibleWithMotherboard,
  isLaptopMemoryFormFactor,
  socketSearchTerms,
  type RamType,
  type Socket,
} from "@/lib/pcCompatibility";
import type { Product, RankedProduct, RecommendResponse } from "@/lib/types";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const SEARCH_LIMIT = 20; // ne cerchiamo di più del solito: molti verranno scartati dal filtro di compatibilità
const RESULT_LIMIT = 12;

const VALID_SOCKETS: Socket[] = ["AM5", "AM4", "LGA1851", "LGA1700", "LGA1200"];
const VALID_RAM_TYPES: RamType[] = ["DDR4", "DDR5"];

export type CoolerOption = RankedProduct & { sockets: Socket[] | null };
export type CaseOption = RankedProduct & { formFactor: string | null };
export type PsuOption = RankedProduct & { wattage: number | null };

async function buildCompatibleResponse(
  label: string,
  candidates: Product[]
): Promise<RecommendResponse> {
  const { items, summary, technicianTip } = await rankCompatibleParts(label, candidates);
  return { query: label, items, summary, technicianTip };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = checkRateLimit(
    `pcbuilder-parts:${ip}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Troppe richieste: riprova tra qualche istante." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let socket: Socket;
  let ramType: RamType;
  let motherboardFormFactor: string | null;
  let maxPrice: number | null;
  try {
    const body = await req.json();
    if (!VALID_SOCKETS.includes(body.socket) || !VALID_RAM_TYPES.includes(body.ramType)) {
      return NextResponse.json({ error: "Socket o tipo RAM non validi" }, { status: 400 });
    }
    socket = body.socket;
    ramType = body.ramType;
    motherboardFormFactor =
      typeof body.motherboardFormFactor === "string" ? body.motherboardFormFactor : null;
    maxPrice = typeof body.maxPrice === "number" ? body.maxPrice : null;
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  try {
    const [cpuSearch, ramSearch, coolerSearch, gpuSearch, psuSearch, caseSearch] =
      await Promise.all([
        searchProducts(socketSearchTerms(socket), SEARCH_LIMIT, { maxPrice }),
        searchProducts(`RAM ${ramType}`, SEARCH_LIMIT, { maxPrice }),
        searchProducts("dissipatore CPU raffreddamento", SEARCH_LIMIT, { maxPrice }),
        searchProducts("scheda video gaming", SEARCH_LIMIT, { maxPrice }),
        searchProducts("alimentatore PC ATX", SEARCH_LIMIT, { maxPrice }),
        searchProducts("case PC gaming", SEARCH_LIMIT, { maxPrice }),
      ]);

    // Doppio livello di precisione: la ricerca è già mirata, ma qui verifichiamo comunque ogni
    // singolo risultato con regex sui dati reali. Chi non supera il controllo viene scartato,
    // mai incluso "per approssimazione".
    const compatibleCpus = cpuSearch
      .filter((p) => detectCpuSocket(p) === socket)
      .slice(0, RESULT_LIMIT);
    const compatibleRam = ramSearch
      .filter((p) => detectRamType(p) === ramType && !isLaptopMemoryFormFactor(p))
      .slice(0, RESULT_LIMIT);

    // Dissipatori: escludiamo subito quelli che dichiarano ESPLICITAMENTE socket diversi dal
    // nostro (incompatibilità certa); il resto (compatibili confermati o non determinabili)
    // passa al pre-filtro standard rileva/dividi/classifica.
    const coolerCandidates = coolerSearch
      .filter((p) => {
        const sockets = detectCoolerSockets(p);
        return sockets === null || sockets.includes(socket);
      })
      .slice(0, SEARCH_LIMIT);
    const airCandidates = coolerCandidates.filter((p) => detectCoolerType(p) === "aria");
    const liquidCandidates = coolerCandidates.filter((p) => detectCoolerType(p) === "liquido");

    // Case: stessa logica dei dissipatori, ma solo se conosciamo il formato della scheda madre
    // scelta; se non lo conosciamo non possiamo verificare nulla, quindi non filtriamo affatto
    // invece di rischiare di escludere opzioni valide.
    const caseCandidates = motherboardFormFactor
      ? caseSearch.filter((p) => {
          const cf = detectCaseFormFactor(p);
          return cf === undefined || isCaseCompatibleWithMotherboard(cf, motherboardFormFactor!);
        })
      : caseSearch;

    const coolerUndetectedReason =
      "Non è stato possibile confermare automaticamente il socket supportato dal titolo: verifica le specifiche prima di scegliere questo dissipatore.";

    const [cpus, ram, coolersAirRaw, coolersLiquidRaw, gpus, psusRaw, casesRaw] =
      await Promise.all([
        buildCompatibleResponse(`Processori compatibili con socket ${socket}`, compatibleCpus),
        buildCompatibleResponse(`RAM ${ramType} compatibile`, compatibleRam),
        rankWithDetection(
          `Dissipatori CPU ad aria compatibili con socket ${socket}`,
          airCandidates,
          detectCoolerSockets,
          coolerUndetectedReason
        ),
        rankWithDetection(
          `Dissipatori CPU a liquido compatibili con socket ${socket}`,
          liquidCandidates,
          detectCoolerSockets,
          coolerUndetectedReason
        ),
        buildCompatibleResponse("Schede video", gpuSearch.slice(0, RESULT_LIMIT)),
        buildCompatibleResponse("Alimentatori PC", psuSearch.slice(0, RESULT_LIMIT)),
        // Rileviamo sempre il formato di ogni case (per il badge), indipendentemente dal fatto
        // che si possa verificare contro la scheda madre: non ha senso scartare un'informazione
        // reale già trovata solo perché manca il termine di paragone.
        rankWithDetection(
          motherboardFormFactor
            ? `Case compatibili con formato ${motherboardFormFactor}`
            : "Case",
          caseCandidates.slice(0, SEARCH_LIMIT),
          (p) => detectCaseFormFactor(p) ?? null,
          motherboardFormFactor
            ? `Non è stato possibile confermare automaticamente il formato di questo case dal titolo: verifica che sia compatibile con una scheda madre ${motherboardFormFactor}.`
            : "Non è stato possibile confermare automaticamente il formato di questo case dal titolo: verifica manualmente la compatibilità con la tua scheda madre."
        ),
      ]);

    const coolersAir: { query: string; items: CoolerOption[]; summary: string; technicianTip: string | null } = {
      query: "dissipatori aria",
      items: coolersAirRaw.items.map(({ meta, ...item }) => ({ ...item, sockets: meta })),
      summary: coolersAirRaw.summary,
      technicianTip: coolersAirRaw.technicianTip,
    };
    const coolersLiquid: { query: string; items: CoolerOption[]; summary: string; technicianTip: string | null } = {
      query: "dissipatori liquido",
      items: coolersLiquidRaw.items.map(({ meta, ...item }) => ({ ...item, sockets: meta })),
      summary: coolersLiquidRaw.summary,
      technicianTip: coolersLiquidRaw.technicianTip,
    };
    const cases: { query: string; items: CaseOption[]; summary: string; technicianTip: string | null } = {
      query: "case",
      items: casesRaw.items.map(({ meta, ...item }) => ({ ...item, formFactor: meta })),
      summary: casesRaw.summary,
      technicianTip: casesRaw.technicianTip,
    };
    const psus: { query: string; items: PsuOption[]; summary: string; technicianTip: string | null } = {
      query: "alimentatori",
      items: psusRaw.items.map((item) => ({ ...item, wattage: detectPsuWattage(item) })),
      summary: psusRaw.summary,
      technicianTip: psusRaw.technicianTip,
    };

    return NextResponse.json({ cpus, ram, coolersAir, coolersLiquid, gpus, psus, cases });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
