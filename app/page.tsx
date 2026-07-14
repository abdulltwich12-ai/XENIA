"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
import ComparisonTable from "@/components/ComparisonTable";
import type { RecommendResponse } from "@/lib/types";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Errore durante la ricerca");
      }
      setResult(data as RecommendResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <section className="flex flex-col items-center gap-6 px-4 pt-16 pb-10 text-center">
        <span className="text-xs font-medium tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
          Confronto prezzi con AI
        </span>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight max-w-2xl">
          Trova il componente migliore, al prezzo migliore.
        </h1>
        <p className="text-black/60 dark:text-white/60 max-w-xl">
          Descrivi cosa cerchi: un&apos;AI analizza i prodotti disponibili e ti mostra una lista
          curata con foto, prezzo e link diretto all&apos;acquisto.
        </p>
        <SearchBar onSearch={handleSearch} loading={loading} />
      </section>

      <section className="flex-1 px-4 pb-16 max-w-6xl mx-auto w-full">
        {error && (
          <div className="max-w-2xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 text-center">
            {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {result && result.items.length > 0 && (
          <div className="flex flex-col gap-8 mt-4">
            <p className="text-sm text-black/70 dark:text-white/70 max-w-3xl">{result.summary}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {result.items.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>

            <div>
              <h2 className="text-lg font-medium mb-3">Confronto completo</h2>
              <ComparisonTable items={result.items} />
            </div>
          </div>
        )}

        {result && result.items.length === 0 && !error && (
          <p className="text-center text-black/60 dark:text-white/60 mt-4">
            Nessun prodotto rilevante trovato per questa ricerca. Prova a riformulare la query.
          </p>
        )}
      </section>
    </main>
  );
}
