"use client";

import { useActionState } from "react";
import { runPartiql, type PartiqlResult } from "./actions";
import { buttonClass } from "@/components/ui";

const show = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v, (_k, x) => (x instanceof Set ? Array.from(x) : typeof x === "bigint" ? x.toString() : x)) : String(v));

export function PartiqlEditor({ table }: { table: string }) {
  const [res, action, pending] = useActionState<PartiqlResult, FormData>(runPartiql, null);
  const cols = Array.from(new Set((res?.items ?? []).flatMap((i) => Object.keys(i))));
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <textarea
          name="statement"
          rows={5}
          defaultValue={`SELECT * FROM "${table}"`}
          spellCheck={false}
          className="w-full rounded-lg border border-control-border bg-[#fbfbfa] p-3 font-mono text-[13px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
        />
        <div className="flex items-center justify-end gap-3">
          {res?.ms !== undefined && <span className="text-sm text-muted">{res.ms} ms</span>}
          <button className={buttonClass("primary")} disabled={pending}>{pending ? "Running…" : "Run"}</button>
        </div>
      </form>
      {res?.error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{res.error}</p>}
      {res?.items && (
        <div className="overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-line text-muted">{cols.map((c) => <th key={c} className="px-3 py-1.5 font-medium">{c}</th>)}</tr></thead>
            <tbody>
              {res.items.length === 0 && <tr><td className="px-3 py-4 text-center text-muted">Completed. No items returned.</td></tr>}
              {res.items.map((it, i) => (
                <tr key={i} className="border-b border-line-soft">{cols.map((c) => <td key={c} className="px-3 py-1.5 font-mono text-[13px]">{show(it[c])}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {res.next && <p className="px-3 py-2 text-xs text-muted">More results available (first 100 shown).</p>}
        </div>
      )}
    </div>
  );
}
