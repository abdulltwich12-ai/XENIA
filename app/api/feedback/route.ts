import { NextRequest, NextResponse } from "next/server";
import { recordFeedback, type FeedbackSignal } from "@/lib/preferences";

export async function POST(req: NextRequest) {
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
    !query
  ) {
    return NextResponse.json({ error: "Dati di feedback incompleti" }, { status: 400 });
  }

  await recordFeedback(userId, {
    productId,
    title,
    price,
    currency,
    source,
    specs,
    signal,
    query,
  });

  return NextResponse.json({ ok: true });
}
