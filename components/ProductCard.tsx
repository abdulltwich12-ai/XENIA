"use client";

import { useState } from "react";
import Image from "next/image";
import type { RankedProduct } from "@/lib/types";

type Props = {
  product: RankedProduct;
  query: string;
  userId: string;
};

export default function ProductCard({ product, query, userId }: Props) {
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [sending, setSending] = useState(false);

  async function sendFeedback(signal: "like" | "dislike") {
    if (!userId || sending) return;
    setSending(true);
    setFeedback(signal);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          productId: product.id,
          title: product.title,
          price: product.price,
          currency: product.currency,
          source: product.source,
          specs: product.specs,
          signal,
          query,
        }),
      });
    } catch {
      // il feedback è un'aggiunta best-effort: se fallisce non blocchiamo l'utente
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border overflow-hidden bg-white dark:bg-white/5 transition hover:shadow-lg ${
        product.bestValue
          ? "border-indigo-500 ring-1 ring-indigo-500"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      {product.bestValue && (
        <span className="absolute top-3 left-3 z-10 rounded-full bg-indigo-600 text-white text-xs font-medium px-3 py-1">
          Scelta AI: miglior rapporto qualità/prezzo
        </span>
      )}
      <div className="relative w-full aspect-square bg-black/5 dark:bg-white/5">
        <Image
          src={product.image}
          alt={product.title}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-contain p-4"
          unoptimized
        />
      </div>
      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium line-clamp-2">{product.title}</h3>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={() => sendFeedback("like")}
              aria-label="Mi interessa"
              title="Mi interessa"
              className={`w-7 h-7 rounded-full border text-xs flex items-center justify-center transition ${
                feedback === "like"
                  ? "bg-green-500/20 border-green-500 text-green-600"
                  : "border-black/10 dark:border-white/15 text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              👍
            </button>
            <button
              type="button"
              onClick={() => sendFeedback("dislike")}
              aria-label="Non fa per me"
              title="Non fa per me"
              className={`w-7 h-7 rounded-full border text-xs flex items-center justify-center transition ${
                feedback === "dislike"
                  ? "bg-red-500/20 border-red-500 text-red-600"
                  : "border-black/10 dark:border-white/15 text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              👎
            </button>
          </div>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl font-semibold">
            {product.price.toFixed(2)} {product.currency}
          </span>
          {product.originalPrice && (
            <>
              <span className="text-xs text-black/40 dark:text-white/40 line-through">
                {product.originalPrice.toFixed(2)} {product.currency}
              </span>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-400">
                -{Math.round((1 - product.price / product.originalPrice) * 100)}%
              </span>
            </>
          )}
          <span className="text-xs text-black/50 dark:text-white/50">via {product.source}</span>
        </div>
        {product.originalPrice && (
          <p className="text-[11px] text-black/40 dark:text-white/40 -mt-1.5">
            Sconto dichiarato dal venditore, non stimato da noi
          </p>
        )}
        {product.condition && (
          <span className="self-start text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
            {product.condition}
          </span>
        )}
        {product.specs && product.specs.length > 0 && (
          <ul className="text-xs text-black/60 dark:text-white/60 list-disc list-inside space-y-0.5">
            {product.specs.slice(0, 3).map((s, i) => (
              <li key={i} className="line-clamp-1">
                {s}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-black/70 dark:text-white/70 mt-1 flex-1">{product.aiReason}</p>
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-center rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium py-2 hover:opacity-90 transition"
        >
          Vai all&apos;offerta
        </a>
        <p className="text-[11px] text-black/40 dark:text-white/40 text-center">
          Prezzo indicativo: verifica quello finale sul sito del venditore
        </p>
      </div>
    </div>
  );
}
