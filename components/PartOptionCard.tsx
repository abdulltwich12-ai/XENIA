"use client";

import ProductImage from "@/components/ProductImage";
import type { RankedProduct } from "@/lib/types";

type Badge = { label: string; tone?: "info" | "warning" };

type Props = {
  product: RankedProduct;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  disabledLabel?: string;
  badges?: Badge[];
};

export default function PartOptionCard({
  product,
  selected,
  onSelect,
  disabled = false,
  disabledLabel = "Verifica manualmente",
  badges = [],
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`relative flex flex-col text-left rounded-2xl border overflow-hidden bg-white dark:bg-white/5 transition ${
        disabled
          ? "opacity-60 cursor-not-allowed border-black/10 dark:border-white/10"
          : selected
            ? "border-indigo-500 ring-2 ring-indigo-500"
            : "border-black/10 dark:border-white/10 hover:border-indigo-400"
      }`}
    >
      {product.bestValue && (
        <span className="absolute top-3 left-3 z-10 rounded-full bg-indigo-600 text-white text-[11px] font-semibold px-3 py-1 uppercase tracking-wide">
          Scelta AI
        </span>
      )}

      <div className="relative w-full aspect-square bg-black/5 dark:bg-white/5">
        <ProductImage src={product.image} alt={product.title} />
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="text-sm font-medium line-clamp-2">{product.title}</h3>
        <span className="text-lg font-semibold">
          {product.price.toFixed(2)} {product.currency}
        </span>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b.label}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  b.tone === "warning"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400"
                }`}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}

        {product.aiReason && (
          <p className="text-xs text-black/70 dark:text-white/70 flex-1">{product.aiReason}</p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <span
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              disabled
                ? "border-black/20 dark:border-white/20"
                : selected
                  ? "border-indigo-600 bg-indigo-600"
                  : "border-black/30 dark:border-white/30"
            }`}
          >
            {selected && !disabled && (
              <span className="w-2 h-2 rounded-full bg-white" aria-hidden />
            )}
          </span>
          <span className="text-xs font-medium text-black/70 dark:text-white/70">
            {disabled ? disabledLabel : selected ? "Selezionato" : "Scegli questo"}
          </span>
        </div>
      </div>
    </button>
  );
}
