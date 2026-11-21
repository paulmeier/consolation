"use client";

import { useState } from "react";

/** Live text filter that hides non-matching rows of the table with id `tableId`. */
export function TableFilter({ tableId, placeholder }: { tableId: string; placeholder: string }) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<number | null>(null);

  function apply(value: string) {
    setQ(value);
    const rows = document.querySelectorAll<HTMLTableRowElement>(`#${CSS.escape(tableId)} tr[data-filter]`);
    const needle = value.trim().toLowerCase();
    let n = 0;
    rows.forEach((r) => {
      const hit = !needle || (r.dataset.filter ?? "").includes(needle);
      r.dataset.hidden = hit ? "false" : "true";
      if (hit) n++;
    });
    setMatches(needle ? n : null);
  }

  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="relative w-full max-w-xl">
        <svg viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => apply(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded border border-control-border bg-surface py-[4px] pr-3 pl-9 text-sm leading-5 placeholder:italic placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
        />
      </div>
      {matches !== null && <span className="text-sm whitespace-nowrap text-muted">{matches} match{matches === 1 ? "" : "es"}</span>}
    </div>
  );
}
