"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import MotherboardCard from "@/components/MotherboardCard";
import ProductCard from "@/components/ProductCard";
import ComparisonTable from "@/components/ComparisonTable";
import { getOrCreateUserId } from "@/lib/userId";
import type { RecommendResponse } from "@/lib/types";
import type { MotherboardOption } from "@/app/api/pc-builder/motherboard/route";

const MOBO_SUGGESTIONS = [
  "Scheda madre AM5 economica",
  "Scheda madre Intel Z790",
  "Scheda madre AM4 per gaming",
  "Scheda madre Mini-ITX",
];

type PartsResponse = { cpus: RecommendResponse; ram: RecommendResponse };

export default function BuildPage() {
  const [userId, setUserId] = useState("");

  const [moboLoading, setMoboLoading] = useState(false);
  const [moboError, setMoboError] = useState<string | null>(null);
  const [moboResult, setMoboResult] = useState<{
    items: MotherboardOption[];
    summary: string;
  } | null>(null);

  const [selected, setSelected] = useState<MotherboardOption | null>(null);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);
  const [parts, setParts] = useState<PartsResponse | null>(null);

  useEffect(() => {
    setUserId(getOrCreateUserId());
  }, []);

  async function handleSearchMotherboard(query: string) {
    setMoboLoading(true);
    setMoboError(null);
    setMoboResult(null);
    setSelected(null);
    setParts(null);
    try {
      const res = await fetch("/api/pc-builder/motherboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore durante la ricerca");
      setMoboResult({ items: data.items, summary: data.summary });
    } catch (err) {
      setMoboError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setMoboLoading(false);
    }
  }

  async function handleSelectMotherboard(option: MotherboardOption) {
    if (!option.platform) return;
    setSelected(option);
    setPartsLoading(true);
    setPartsError(null);
    setParts(null);
    try {
      const res = await fetch("/api/pc-builder/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socket: option.platform.socket,
          ramType: option.platform.ramType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore durante la ricerca dei componenti");
      setParts(data);
    } catch (err) {
      setPartsError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setPartsLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <section className="flex flex-col items-center gap-6 px-4 pt-16 pb-10 text-center">
        <Link
          href="/"
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Torna alla ricerca generale
        </Link>
        <span className="text-xs font-medium tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
          Crea il tuo PC
        </span>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight max-w-2xl">
          Scegli una scheda madre, trova subito CPU e RAM compatibili.
        </h1>
        <p className="text-black/60 dark:text-white/60 max-w-2xl text-sm">
          Il socket della CPU e il tipo di RAM vengono verificati automaticamente in modo
          rigoroso: se un prodotto non può essere confermato compatibile, viene escluso invece
          che indovinato. <strong>Copre solo CPU e RAM</strong>: scheda video, alimentatore,
          case e storage vanno comunque verificati manualmente.
        </p>
        <SearchBar
          onSearch={handleSearchMotherboard}
          loading={moboLoading}
          placeholder="Es. 'scheda madre AM5 economica'"
          suggestions={MOBO_SUGGESTIONS}
        />
      </section>

      <section className="flex-1 px-4 pb-16 max-w-6xl mx-auto w-full flex flex-col gap-10">
        {moboError && (
          <div className="max-w-2xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 text-center">
            {moboError}
          </div>
        )}

        {moboLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {moboResult && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-medium">1. Scegli la scheda madre</h2>
            <p className="text-sm text-black/70 dark:text-white/70">{moboResult.summary}</p>
            {moboResult.items.length === 0 ? (
              <p className="text-center text-black/60 dark:text-white/60">
                Nessuna scheda madre trovata. Prova a riformulare la ricerca.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {moboResult.items.map((option) => (
                  <MotherboardCard
                    key={option.id}
                    option={option}
                    selected={selected?.id === option.id}
                    onSelect={() => handleSelectMotherboard(option)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {selected && selected.platform && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm">
            Scheda madre scelta: <strong>{selected.title}</strong> — Socket{" "}
            <strong>{selected.platform.socket}</strong>, RAM{" "}
            <strong>{selected.platform.ramType}</strong>
          </div>
        )}

        {partsError && (
          <div className="max-w-2xl mx-auto rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 text-center">
            {partsError}
          </div>
        )}

        {partsLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {parts && (
          <>
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-medium">2. Processori compatibili</h2>
              <p className="text-sm text-black/70 dark:text-white/70">{parts.cpus.summary}</p>
              {parts.cpus.items.length === 0 ? (
                <p className="text-center text-black/60 dark:text-white/60">
                  Nessun processore compatibile trovato in questo momento.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {parts.cpus.items.map((item) => (
                      <ProductCard
                        key={item.id}
                        product={item}
                        query={parts.cpus.query}
                        userId={userId}
                      />
                    ))}
                  </div>
                  <ComparisonTable items={parts.cpus.items} />
                </>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-medium">3. RAM compatibile</h2>
              <p className="text-sm text-black/70 dark:text-white/70">{parts.ram.summary}</p>
              {parts.ram.items.length === 0 ? (
                <p className="text-center text-black/60 dark:text-white/60">
                  Nessuna RAM compatibile trovata in questo momento.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {parts.ram.items.map((item) => (
                      <ProductCard
                        key={item.id}
                        product={item}
                        query={parts.ram.query}
                        userId={userId}
                      />
                    ))}
                  </div>
                  <ComparisonTable items={parts.ram.items} />
                </>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
