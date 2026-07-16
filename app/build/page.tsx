"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import PartOptionCard from "@/components/PartOptionCard";
import type { RankedProduct, RecommendResponse } from "@/lib/types";
import type { MotherboardOption } from "@/app/api/pc-builder/motherboard/route";
import type { CaseOption, CoolerOption, PsuOption } from "@/app/api/pc-builder/parts/route";

const MOBO_SUGGESTIONS = [
  "Scheda madre AM5 economica",
  "Scheda madre Intel Z790",
  "Scheda madre AM4 per gaming",
  "Scheda madre Mini-ITX",
];

type PartsResponse = {
  cpus: RecommendResponse;
  ram: RecommendResponse;
  coolersAir: { items: CoolerOption[]; summary: string };
  coolersLiquid: { items: CoolerOption[]; summary: string };
  gpus: RecommendResponse;
  psus: { items: PsuOption[]; summary: string };
  cases: { items: CaseOption[]; summary: string };
};

function formatPrice(value: number) {
  return value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PartSection<T extends RankedProduct>({
  step,
  title,
  active,
  inactiveMessage,
  loading,
  summary,
  items,
  emptyMessage,
  renderGrid,
  extra,
}: {
  step: number;
  title: string;
  active: boolean;
  inactiveMessage: string;
  loading: boolean;
  summary: string | null;
  items: T[] | null;
  emptyMessage: string;
  renderGrid: (items: T[]) => ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section className="max-w-6xl mx-auto w-full px-4 pb-6">
      <div
        className={`text-sm font-semibold tracking-wide uppercase px-4 py-3 rounded-t-xl ${
          active ? "bg-black text-white" : "bg-black/30 text-white/60"
        }`}
      >
        {step}) {title}
      </div>
      <div className="border border-t-0 border-black/10 dark:border-white/10 rounded-b-xl p-4">
        {!active && (
          <p className="text-sm text-black/50 dark:text-white/50 text-center py-6">
            {inactiveMessage}
          </p>
        )}

        {active && loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse"
              />
            ))}
          </div>
        )}

        {active && !loading && items && (
          <>
            {extra}
            {summary && <p className="text-sm text-black/70 dark:text-white/70 mb-4">{summary}</p>}
            {items.length === 0 ? (
              <p className="text-center text-black/60 dark:text-white/60">{emptyMessage}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {renderGrid(items)}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
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
  const [selectedCooler, setSelectedCooler] = useState<CoolerOption | null>(null);
  const [coolerTab, setCoolerTab] = useState<"aria" | "liquido">("aria");
  const [selectedRam, setSelectedRam] = useState<RankedProduct | null>(null);
  const [selectedGpu, setSelectedGpu] = useState<RankedProduct | null>(null);
  const [selectedPsu, setSelectedPsu] = useState<PsuOption | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);

  async function handleSearchMotherboard(query: string) {
    setMoboLoading(true);
    setMoboError(null);
    setMoboResult(null);
    setSelectedMotherboard(null);
    setParts(null);
    setSelectedCpu(null);
    setSelectedCooler(null);
    setSelectedRam(null);
    setSelectedGpu(null);
    setSelectedPsu(null);
    setSelectedCase(null);
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
    setSelectedCooler(null);
    setSelectedRam(null);
    setSelectedGpu(null);
    setSelectedPsu(null);
    setSelectedCase(null);
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
          motherboardFormFactor: option.platform.formFactor ?? null,
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

  const chosenCount = [
    selectedMotherboard,
    selectedCpu,
    selectedCooler,
    selectedRam,
    selectedGpu,
    selectedPsu,
    selectedCase,
  ].filter(Boolean).length;
  const total =
    (selectedMotherboard?.price ?? 0) +
    (selectedCpu?.price ?? 0) +
    (selectedCooler?.price ?? 0) +
    (selectedRam?.price ?? 0) +
    (selectedGpu?.price ?? 0) +
    (selectedPsu?.price ?? 0) +
    (selectedCase?.price ?? 0);

  const activeCoolerItems = parts
    ? coolerTab === "aria"
      ? parts.coolersAir.items
      : parts.coolersLiquid.items
    : null;
  const activeCoolerSummary = parts
    ? coolerTab === "aria"
      ? parts.coolersAir.summary
      : parts.coolersLiquid.summary
    : null;

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
            <span className="text-white/60">{chosenCount}/7 componenti scelti</span>
            <span className="font-semibold text-base sm:text-lg">
              Totale: {formatPrice(total)} €
            </span>
          </div>
        </div>
      </div>

      <section className="max-w-6xl mx-auto w-full px-4 pt-6 pb-4">
        <p className="text-sm text-black/60 dark:text-white/60">
          Scegli una scheda madre: socket CPU, tipo di RAM e formato vengono verificati in modo
          rigoroso da un controllo automatico, e l&apos;AI ti aiuta a scegliere tra le opzioni già
          garantite compatibili. Scheda video e alimentatore non hanno un vincolo di compatibilità
          binario reale da verificare (lo slot PCIe è universale, la potenza necessaria dipende da
          troppi fattori per una stima affidabile dal solo annuncio): per l&apos;alimentatore
          mostriamo il wattaggio quando disponibile, ma la scelta finale resta tua.{" "}
          <strong>Copre tutto tranne lo storage</strong>, che va ancora scelto a parte.
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
                              {
                                label: `RAM ${option.platform.ramType}${option.platform.ramTypeInferred ? " (dedotta)" : ""}`,
                                tone: option.platform.ramTypeInferred
                                  ? ("warning" as const)
                                  : undefined,
                              },
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
      <PartSection
        step={2}
        title={`Processore compatibile${selectedMotherboard?.platform ? ` (socket ${selectedMotherboard.platform.socket})` : ""}`}
        active={!!selectedMotherboard}
        inactiveMessage="Seleziona prima una scheda madre compatibile qui sopra."
        loading={partsLoading}
        summary={parts?.cpus.summary ?? null}
        items={parts?.cpus.items ?? null}
        emptyMessage="Nessun processore compatibile trovato in questo momento."
        renderGrid={(items) =>
          items.map((item) => (
            <PartOptionCard
              key={item.id}
              product={item}
              selected={selectedCpu?.id === item.id}
              onSelect={() => setSelectedCpu(item)}
            />
          ))
        }
      />

      {/* Step 3: Dissipatore */}
      <PartSection
        step={3}
        title="Dissipatore CPU"
        active={!!selectedMotherboard}
        inactiveMessage="Seleziona prima una scheda madre compatibile qui sopra."
        loading={partsLoading}
        summary={activeCoolerSummary}
        items={activeCoolerItems}
        emptyMessage="Nessun dissipatore compatibile trovato in questo momento."
        extra={
          <div className="flex gap-2 mb-4">
            {(["aria", "liquido"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCoolerTab(tab)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                  coolerTab === tab
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-black/15 dark:border-white/15 text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {tab === "aria" ? "Ad aria" : "A liquido"}
              </button>
            ))}
          </div>
        }
        renderGrid={(items) =>
          items.map((item) => (
            <PartOptionCard
              key={item.id}
              product={item}
              selected={selectedCooler?.id === item.id}
              onSelect={() => setSelectedCooler(item)}
              badges={
                item.sockets
                  ? [{ label: "Socket confermato" }]
                  : [{ label: "Socket non confermato", tone: "warning" as const }]
              }
            />
          ))
        }
      />

      {/* Step 4: RAM */}
      <PartSection
        step={4}
        title={`RAM compatibile${selectedMotherboard?.platform ? ` (${selectedMotherboard.platform.ramType})` : ""}`}
        active={!!selectedMotherboard}
        inactiveMessage="Seleziona prima una scheda madre compatibile qui sopra."
        loading={partsLoading}
        summary={parts?.ram.summary ?? null}
        items={parts?.ram.items ?? null}
        emptyMessage="Nessuna RAM compatibile trovata in questo momento."
        renderGrid={(items) =>
          items.map((item) => (
            <PartOptionCard
              key={item.id}
              product={item}
              selected={selectedRam?.id === item.id}
              onSelect={() => setSelectedRam(item)}
            />
          ))
        }
      />

      {/* Step 5: Scheda video */}
      <PartSection
        step={5}
        title="Scheda video"
        active={!!selectedMotherboard}
        inactiveMessage="Seleziona prima una scheda madre qui sopra."
        loading={partsLoading}
        summary={parts?.gpus.summary ?? null}
        items={parts?.gpus.items ?? null}
        emptyMessage="Nessuna scheda video trovata in questo momento."
        renderGrid={(items) =>
          items.map((item) => (
            <PartOptionCard
              key={item.id}
              product={item}
              selected={selectedGpu?.id === item.id}
              onSelect={() => setSelectedGpu(item)}
            />
          ))
        }
      />

      {/* Step 6: Alimentatore */}
      <PartSection
        step={6}
        title="Alimentatore"
        active={!!selectedMotherboard}
        inactiveMessage="Seleziona prima una scheda madre qui sopra."
        loading={partsLoading}
        summary={parts?.psus.summary ?? null}
        items={parts?.psus.items ?? null}
        emptyMessage="Nessun alimentatore trovato in questo momento."
        renderGrid={(items) =>
          items.map((item) => (
            <PartOptionCard
              key={item.id}
              product={item}
              selected={selectedPsu?.id === item.id}
              onSelect={() => setSelectedPsu(item)}
              badges={item.wattage ? [{ label: `${item.wattage}W` }] : []}
            />
          ))
        }
      />

      {/* Step 7: Case */}
      <PartSection
        step={7}
        title={`Case${selectedMotherboard?.platform?.formFactor ? ` (min. ${selectedMotherboard.platform.formFactor})` : ""}`}
        active={!!selectedMotherboard}
        inactiveMessage="Seleziona prima una scheda madre qui sopra."
        loading={partsLoading}
        summary={parts?.cases.summary ?? null}
        items={parts?.cases.items ?? null}
        emptyMessage="Nessun case compatibile trovato in questo momento."
        renderGrid={(items) =>
          items.map((item) => (
            <PartOptionCard
              key={item.id}
              product={item}
              selected={selectedCase?.id === item.id}
              onSelect={() => setSelectedCase(item)}
              badges={
                item.formFactor
                  ? [{ label: item.formFactor }]
                  : [{ label: "Formato non rilevato", tone: "warning" as const }]
              }
            />
          ))
        }
      />

      {/* Prossimamente */}
      <section className="max-w-6xl mx-auto w-full px-4 pb-6">
        <div className="bg-black/30 text-white/60 text-sm font-semibold tracking-wide uppercase px-4 py-3 rounded-xl">
          Prossimamente: storage (SSD/HDD)
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
                { label: "Dissipatore", item: selectedCooler },
                { label: "RAM", item: selectedRam },
                { label: "Scheda video", item: selectedGpu },
                { label: "Alimentatore", item: selectedPsu },
                { label: "Case", item: selectedCase },
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
