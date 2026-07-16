"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  src: string;
  alt: string;
};

export default function ProductImage({ src, alt }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-black/30 dark:text-white/30">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 9h6v6H9z" />
          <path d="M4 9h1M4 15h1M19 9h1M19 15h1M9 4v1M15 4v1M9 19v1M15 19v1" />
        </svg>
        <span className="text-[11px]">Foto non disponibile</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 25vw"
      className="object-contain p-4"
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
