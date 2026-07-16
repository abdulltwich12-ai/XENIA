"use client";

import { useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import PartOptionCard from "@/components/PartOptionCard";
import type { RankedProduct, RecommendResponse } from "@/lib/types";
import type { MotherboardOption } from "@/app/api/pc-builder/motherboard/route";

const MOBO_SUGGESTIONS = [
  "Scheda madre AM5 economica",
  "Scheda madre Intel Z790",
  "Scheda madre AM4 per gaming",
  "Scheda madre Mini-ITX",
];

type PartsResponse = { cpus: RecommendResponse; ram: RecommendResponse };

function formatPrice(value: number) {
  return value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BuildPage() {
  const [moboLoading, setMoboLoading] = useState(false);
  const [moboError, setMoboError] = useState<string | null>(null);
  const [moboResult, setMoboResult] = useState<{
    items: MotherboardOption[];
    summary: string;
  } | null>(null);

  const [selectedMotherboard, setSelectedMotherboard] = useState<MotherboardOption | null>(null);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);
  const [parts, setParts] = useState<PartsResponse | null>(null);
  const [selectedCpu, setSelectedCpu] = useState<RankedProduct | null>(null);
  const [selectedRam, setSelectedRam] = useState<RankedProduct | null>(null);

  async function handleSearchMotherboard(query: string) {
    setMoboLoading(true);
    setMoboError(null);
    setMoboResult(null);
    setSelectedMotherboard(null);
    setParts(null);
    setSelectedCpu(null);
    setSelectedRam(null);
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
    setSelectedMotherboard(option);
    setSelectedCpu(null);
    setSelectedRam(null);
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

  const chosenCount = [selectedMotherboard, selectedCpu, selectedRam].filter(Boolean).length;
  const total =
    (selectedMotherboard?.price ?? 0) + (selectedCpu?.price ?? 0) + (selectedRam?.price ?? 0);

  return (
    <main className="flex-1 flex flex-col">
      {/* Barra riepilogo in stile configuratore */}
      <div className="sticky top-0 z-20 bg-neutral-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-white/60 hover:text-white transition">
              ← Ricerca generale
            </Link>
            <span className="font-semibold tracking-wide text-sm sm:text-base uppercase">
              Configura il tuo PC
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/60">{chosenCount}/3 componenti scelti</span>
            <span className="font-semibold text-base sm:text-lg">
              Totale: {formatPrice(total)} €
            </span>
          </div>
        </div>
      </div>

      <section className="max-w-6xl mx-auto w-full px-4 pt-6 pb-4">
        <p className="text-sm text-black/60 dark:text-white/60">
          Scegli una scheda madre: il socket della CPU e il tipo di RAM vengono verificati in modo
          rigoroso da un controllo automatico, e l&apos;AI ti aiuta a scegliere tra le opzioni già
          garantite compatibili. <strong>Copre solo CPU e RAM</strong>: scheda video,
          alimentatore, case e storage vanno ancora verificati manualmente.
        </p>
      </section>

      {/* Step 1: scheda madre */}
      <section className="max-w-6xl mx-auto w-full px-4 pb-6">
        <div className="bg-black text-white text-sm font-semibold tracking-wide uppercase px-4 py-3 rounded-t-xl">
          1) Scegli la scheda madre
        </div>
        <div className="border border-t-0 border-black/10 dark:border-white/10 rounded-b-xl p-4 flex flex-col gap-4">
          <SearchBar
            onSearch={handleSearchMotherboard}
            loading={moboLoading}
            placeholder="Es. 'scheda madre AM5 economica'"
            suggestions={MOBO_SUGGESTIONS}
          />

          {moboError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 text-center">
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
            <>
              <p className="text-sm text-black/70 dark:text-white/70">{moboResult.summary}</p>
              {moboResult.items.length === 0 ? (
                <p className="text-center text-black/60 dark:text-white/60">
                  Nessuna scheda madre trovata. Prova a riformulare la ricerca.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {moboResult.items.map((option) => (
                    <PartOptionCard
                      key={option.id}
                      product={option}
                      selected={selectedMotherboard?.id === option.id}
                      onSelect={() => handleSelectMotherboard(option)}
                      disabled={!option.platform}
                      disabledLabel="Compatibilità non rilevata"
                      badges={
                        option.platform
                          ? [
                              { label: `Socket ${option.platform.socket}` },
                              { label: `RAM ${option.platform.ramType}` },
                              ...(option.platform.formFactor
                                ? [{ label: option.platform.formFactor }]
                                : []),
                            ]
                          : [{ label: "Compatibilità non rilevata", tone: "warning" as const }]
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Step 2: CPU */}
      <section className="max-w-6xl mx-auto w-full px-4 pb-6">
        <div
          className={`text-sm font-semibold tracking-wide uppercase px-4 py-3 rounded-t-xl ${
            selectedMotherboard ? "bg-black text-white" : "bg-black/30 text-white/60"
          }`}
        >
          2) Processore compatibile {selectedMotherboard && `(socket ${selectedMotherboard.platform?.socket})`}
        </div>
        <div className="border border-t-0 border-black/10 dark:border-white/10 rounded-b-xl p-4">
          {!selectedMotherboard && (
            <p className="text-sm text-black/50 dark:text-white/50 text-center py-6">
              Seleziona prima una scheda madre compatibile qui sopra.
            </p>
          )}

          {selectedMotherboard && partsError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-3 text-center">
              {partsError}
            </div>
          )}

          {selectedMotherboard && partsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"
                />
              ))}
            </div>
          )}

          {selectedMotherboard && parts && (
            <>
              <p className="text-sm text-black/70 dark:text-white/70 mb-4">{parts.cpus.summary}</p>
              {parts.cpus.items.length === 0 ? (
                <p className="text-center text-black/60 dark:text-white/60">
                  Nessun processore compatibile trovato in questo momento.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {parts.cpus.items.map((item) => (
                    <PartOptionCard
                      key={item.id}
                      product={item}
                      selected={selectedCpu?.id === item.id}
                      onSelect={() => setSelectedCpu(item)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Step 3: RAM */}
      <section className="max-w-6xl mx-auto w-full px-4 pb-6">
        <div
          className={`text-sm font-semibold tracking-wide uppercase px-4 py-3 rounded-t-xl ${
            selectedMotherboard ? "bg-black text-white" : "bg-black/30 text-white/60"
          }`}
        >
          3) RAM compatibile {selectedMotherboard && `(${selectedMotherboard.platform?.ramType})`}
        </div>
        <div className="border border-t-0 border-black/10 dark:border-white/10 rounded-b-xl p-4">
          {!selectedMotherboard && (
            <p className="text-sm text-black/50 dark:text-white/50 text-center py-6">
              Seleziona prima una scheda madre compatibile qui sopra.
            </p>
          )}

          {selectedMotherboard && partsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"
                />
              ))}
            </div>
          )}

          {selectedMotherboard && parts && (
            <>
              <p className="text-sm text-black/70 dark:text-white/70 mb-4">{parts.ram.summary}</p>
              {parts.ram.items.length === 0 ? (
                <p className="text-center text-black/60 dark:text-white/60">
                  Nessuna RAM compatibile trovata in questo momento.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {parts.ram.items.map((item) => (
                    <PartOptionCard
                      key={item.id}
                      product={item}
                      selected={selectedRam?.id === item.id}
                      onSelect={() => setSelectedRam(item)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Prossimamente */}
      <section className="max-w-6xl mx-auto w-full px-4 pb-6">
        <div className="bg-black/30 text-white/60 text-sm font-semibold tracking-wide uppercase px-4 py-3 rounded-xl">
          Prossimamente: scheda video, alimentatore, case, storage
        </div>
      </section>

      {/* Riepilogo finale */}
      {selectedMotherboard && (
        <section className="max-w-6xl mx-auto w-full px-4 pb-16">
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Riepilogo della tua build</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {[
                { label: "Scheda madre", item: selectedMotherboard },
                { label: "Processore", item: selectedCpu },
                { label: "RAM", item: selectedRam },
              ].map(({ label, item }) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-2 last:border-0"
                >
                  <span className="text-black/50 dark:text-white/50 w-28 shrink-0">{label}</span>
                  {item ? (
                    <>
                      <span className="flex-1 line-clamp-1">{item.title}</span>
                      <span className="font-medium shrink-0">
                        {item.price.toFixed(2)} {item.currency}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                      >
                        Vai all&apos;offerta →
                      </a>
                    </>
                  ) : (
                    <span className="text-black/40 dark:text-white/40 flex-1">
                      Non ancora scelto
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-black/60 dark:text-white/60">
                Totale componenti scelti
              </span>
              <span className="text-xl font-semibold">{formatPrice(total)} €</span>
            </div>
            <p className="text-[11px] text-black/40 dark:text-white/40">
              I link portano ai singoli venditori: questo sito non gestisce acquisti o carrelli,
              solo confronto e verifica di compatibilità. Prezzo indicativo: verifica quello
              finale sul sito del venditore.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
