import Image from "next/image";
import type { RankedProduct } from "@/lib/types";

export default function ProductCard({ product }: { product: RankedProduct }) {
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
        <h3 className="text-sm font-medium line-clamp-2">{product.title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold">
            {product.price.toFixed(2)} {product.currency}
          </span>
          <span className="text-xs text-black/50 dark:text-white/50">via {product.source}</span>
        </div>
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
      </div>
    </div>
  );
}
