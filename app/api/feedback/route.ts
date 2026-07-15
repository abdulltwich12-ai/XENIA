import { NextRequest, NextResponse } from "next/server";
import { recordFeedback, type FeedbackSignal } from "@/lib/preferences";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RATE_LIMIT = 30; // richieste
const RATE_WINDOW_MS = 60 * 1000; // per minuto

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = checkRateLimit(`feedback:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Troppe richieste: riprova tra qualche istante." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let body: {
    userId?: string;
    productId?: string;
    title?: string;
    price?: number;
    currency?: string;
    source?: string;
    specs?: string[];
    signal?: FeedbackSignal;
    query?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const { userId, productId, title, price, currency, source, specs, signal, query } = body;

  if (
    !userId ||
    !productId ||
    !title ||
    typeof price !== "number" ||
    !currency ||
    !source ||
    (signal !== "like" && signal !== "dislike") ||
    !query ||
    userId.length > 100 ||
    title.length > 300 ||
    query.length > 300
  ) {
    return NextResponse.json({ error: "Dati di feedback incompleti o non validi" }, { status: 400 });
  }

  await recordFeedback(userId, {
    productId: productId.slice(0, 200),
    title: title.slice(0, 300),
    price,
    currency,
    source: source.slice(0, 100),
    specs: Array.isArray(specs) ? specs.slice(0, 10).map((s) => String(s).slice(0, 200)) : undefined,
    signal,
    query: query.slice(0, 300),
  });

  return NextResponse.json({ ok: true });
}
