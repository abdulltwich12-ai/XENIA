"use client";

import { useState, FormEvent } from "react";

type Props = {
  onSearch: (query: string) => void;
  loading: boolean;
};

const SUGGESTIONS = [
  "Cuffie bluetooth economiche",
  "Monitor 27 pollici per lavoro",
  "Smartwatch sotto 100 euro",
  "Powerbank leggero per viaggi",
  "Webcam per streaming su Twitch",
  "Microfono USB per dirette TikTok/Kick",
  "Capture card per streaming da console",
];

export default function SearchBar({ onSearch, loading }: Props) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSearch(trimmed);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Cosa stai cercando? Es. 'cuffie bluetooth economiche'"
          className="flex-1 rounded-full border border-black/10 bg-white/80 dark:bg-white/10 dark:border-white/15 px-5 py-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-indigo-500 transition"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 text-sm sm:text-base font-medium transition"
        >
          {loading ? "Cerco..." : "Cerca con AI"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 justify-center">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setValue(s);
              onSearch(s);
            }}
            disabled={loading}
            className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-black/10 dark:border-white/15 text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
