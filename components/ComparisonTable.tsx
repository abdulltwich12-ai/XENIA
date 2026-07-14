import type { RankedProduct } from "@/lib/types";

export default function ComparisonTable({ items }: { items: RankedProduct[] }) {
  const sorted = [...items].sort((a, b) => a.price - b.price);

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm text-left">
        <thead className="bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60">
          <tr>
            <th className="px-4 py-3 font-medium">Prodotto</th>
            <th className="px-4 py-3 font-medium">Prezzo</th>
            <th className="px-4 py-3 font-medium">Punteggio AI</th>
            <th className="px-4 py-3 font-medium">Fonte</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr
              key={item.id}
              className="border-t border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <td className="px-4 py-3 max-w-xs">
                <div className="flex items-center gap-2">
                  <span className="line-clamp-1">{item.title}</span>
                  {item.bestValue && (
                    <span className="shrink-0 text-xs rounded-full bg-indigo-600 text-white px-2 py-0.5">
                      Top
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-semibold whitespace-nowrap">
                {item.price.toFixed(2)} {item.currency}
              </td>
              <td className="px-4 py-3">{item.aiScore}/100</td>
              <td className="px-4 py-3 text-black/60 dark:text-white/60">{item.source}</td>
              <td className="px-4 py-3">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
                >
                  Vedi offerta →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
