"use client";

import Image from "next/image";
import type { MotherboardOption } from "@/app/api/pc-builder/motherboard/route";
import { SOCKET_LABELS } from "@/lib/pcCompatibility";

type Props = {
  option: MotherboardOption;
  selected: boolean;
  onSelect: () => void;
};

export default function MotherboardCard({ option, selected, onSelect }: Props) {
  const compatible = option.platform !== null;

  return (
    <div
      className={`flex flex-col rounded-2xl border overflow-hidden bg-white dark:bg-white/5 transition ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-500"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <div className="relative w-full aspect-square bg-black/5 dark:bg-white/5">
        <Image
          src={option.image}
          alt={option.title}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-contain p-4"
          unoptimized
        />
      </div>
      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="text-sm font-medium line-clamp-2">{option.title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">
            {option.price.toFixed(2)} {option.currency}
          </span>
          <span className="text-xs text-black/50 dark:text-white/50">via {option.source}</span>
        </div>

        {option.platform ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-400">
              Socket {SOCKET_LABELS[option.platform.socket]}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-400">
              RAM {option.platform.ramType}
            </span>
            {option.platform.formFactor && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60">
                {option.platform.formFactor}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 self-start">
            Compatibilità non rilevata automaticamente
          </span>
        )}

        <p className="text-xs text-black/70 dark:text-white/70 flex-1">{option.aiReason}</p>

        <button
          type="button"
          onClick={onSelect}
          disabled={!compatible}
          className={`mt-2 rounded-full text-sm font-medium py-2 transition ${
            !compatible
              ? "bg-black/10 dark:bg-white/10 text-black/40 dark:text-white/40 cursor-not-allowed"
              : selected
                ? "bg-indigo-600 text-white"
                : "bg-black dark:bg-white text-white dark:text-black hover:opacity-90"
          }`}
        >
          {!compatible
            ? "Verifica manualmente"
            : selected
              ? "Scheda madre selezionata"
              : "Scegli questa scheda madre"}
        </button>
      </div>
    </div>
  );
}
