import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/serpapi";
import { rankCompatibleParts } from "@/lib/ai";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  detectCpuSocket,
  detectRamType,
  isLaptopMemoryFormFactor,
  socketSearchTerms,
  type RamType,
  type Socket,
} from "@/lib/pcCompatibility";
import type { Product, RecommendResponse } from "@/lib/types";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const SEARCH_LIMIT = 20; // ne cerchiamo di più del solito: molti verranno scartati dal filtro di compatibilità
const RESULT_LIMIT = 12;

const VALID_SOCKETS: Socket[] = ["AM5", "AM4", "LGA1851", "LGA1700", "LGA1200"];
const VALID_RAM_TYPES: RamType[] = ["DDR4", "DDR5"];

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
  let maxPrice: number | null;
  try {
    const body = await req.json();
    if (!VALID_SOCKETS.includes(body.socket) || !VALID_RAM_TYPES.includes(body.ramType)) {
      return NextResponse.json({ error: "Socket o tipo RAM non validi" }, { status: 400 });
    }
    socket = body.socket;
    ramType = body.ramType;
    maxPrice = typeof body.maxPrice === "number" ? body.maxPrice : null;
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  try {
    const [cpuSearch, ramSearch] = await Promise.all([
      searchProducts(socketSearchTerms(socket), SEARCH_LIMIT, { maxPrice }),
      searchProducts(`RAM ${ramType}`, SEARCH_LIMIT, { maxPrice }),
    ]);

    // Doppio livello di precisione: la ricerca è già mirata al socket/tipo RAM, ma qui
    // verifichiamo comunque ogni singolo risultato con regex sui nomi modello reali.
    // Chi non supera il controllo viene scartato, mai incluso "per approssimazione".
    const compatibleCpus = cpuSearch
      .filter((p) => detectCpuSocket(p) === socket)
      .slice(0, RESULT_LIMIT);
    const compatibleRam = ramSearch
      .filter((p) => detectRamType(p) === ramType && !isLaptopMemoryFormFactor(p))
      .slice(0, RESULT_LIMIT);

    const [cpus, ram] = await Promise.all([
      buildCompatibleResponse(`Processori compatibili con socket ${socket}`, compatibleCpus),
      buildCompatibleResponse(`RAM ${ramType} compatibile`, compatibleRam),
    ]);

    return NextResponse.json({ cpus, ram });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
