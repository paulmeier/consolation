"use client";

import { useState } from "react";
import { buttonClass, cx } from "../ui";

type Row = { k: string; v: string };

function parse(initial: string): { mode: "kv" | "plain"; rows: Row[] } {
  try {
    const o = JSON.parse(initial);
    if (o && typeof o === "object" && !Array.isArray(o) && Object.values(o).every((v) => typeof v !== "object" || v === null)) {
      const rows = Object.entries(o).map(([k, v]) => ({ k, v: v === null ? "" : String(v) }));
      return { mode: "kv", rows: rows.length ? rows : [{ k: "", v: "" }] };
    }
  } catch {
    /* not JSON */
  }
  return { mode: initial ? "plain" : "kv", rows: [{ k: "", v: "" }] };
}

/**
 * Secrets Manager style value editor: "Key/value" rows or "Plaintext".
 * Serializes into a hidden input named `name` (JSON object for key/value).
 */
export function KeyValueEditor({ name, initial = "" }: { name: string; initial?: string }) {
  const start = parse(initial);
  const [mode, setMode] = useState<"kv" | "plain">(start.mode);
  const [rows, setRows] = useState<Row[]>(start.rows);
  const [plain, setPlain] = useState(start.mode === "plain" ? initial : JSON.stringify(Object.fromEntries(start.rows.filter((r) => r.k).map((r) => [r.k, r.v])), null, 2));
  const value = mode === "kv" ? JSON.stringify(Object.fromEntries(rows.filter((r) => r.k).map((r) => [r.k, r.v]))) : plain;
  const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";
  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-1 border-b border-line">
        {(["kv", "plain"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (m === "plain" && mode === "kv") setPlain(JSON.stringify(Object.fromEntries(rows.filter((r) => r.k).map((r) => [r.k, r.v])), null, 2));
              if (m === "kv" && mode === "plain") setRows(parse(plain).rows);
              setMode(m);
            }}
            className={cx("-mb-px border-b-[3px] px-3 py-1.5 text-sm font-semibold", mode === m ? "border-accent text-accent" : "border-transparent hover:text-accent")}
          >
            {m === "kv" ? "Key/value" : "Plaintext"}
          </button>
        ))}
      </div>
      {mode === "kv" ? (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label="Key" placeholder="key" value={r.k} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} className={input} />
              <input aria-label="Value" placeholder="value" value={r.v} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} className={input} />
              <button type="button" className={buttonClass("normal")} onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ k: "", v: "" }])}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className={buttonClass("normal")} onClick={() => setRows([...rows, { k: "", v: "" }])}>
            + Add row
          </button>
        </div>
      ) : (
        <textarea value={plain} onChange={(e) => setPlain(e.target.value)} rows={8} spellCheck={false} className={cx(input, "font-mono text-[13px]")} />
      )}
    </div>
  );
}
