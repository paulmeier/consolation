"use client";

import { useEffect, useState } from "react";

type Flash = { type: "success" | "error" | "info"; message: string; id?: number };

export function Flashbar({ initial }: { initial: Flash | null }) {
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => {
    if (initial) document.cookie = "consolation_flash=; Max-Age=0; path=/";
  }, [initial]);
  const flash = initial && initial.id !== dismissed ? initial : null;
  if (!flash) return null;
  const bg = { success: "bg-success", error: "bg-danger", info: "bg-accent" }[flash.type];
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-xl px-4 py-3 text-on-strong ${bg}`} role="status">
      <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="10" cy="10" r="8" />
        {flash.type === "success" ? <path d="M6 10.5l3 3 5-6" /> : <path d="M10 6v5M10 13.5v.5" />}
      </svg>
      <p className="flex-1 break-words">{flash.message}</p>
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(flash.id ?? 0)} className="opacity-80 hover:opacity-100">
        <svg viewBox="0 0 16 16" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
}
