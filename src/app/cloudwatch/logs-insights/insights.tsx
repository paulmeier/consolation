"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { pollInsightsQuery, startInsightsQuery, stopInsightsQuery, type QueryState } from "../actions";
import { buttonClass, cx } from "@/components/ui";

const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";
const RANGES: [number, string][] = [
  [5, "5m"],
  [30, "30m"],
  [60, "1h"],
  [180, "3h"],
  [720, "12h"],
  [1440, "1d"],
  [10080, "1w"],
  [0, "All"],
];
export const SAMPLE_QUERY = "fields @timestamp, @message, @logStream\n| sort @timestamp desc\n| limit 100";

export function Insights({ groups, initialGroups, initialQuery }: { groups: string[]; initialGroups: string[]; initialQuery: string }) {
  const [selected, setSelected] = useState<string[]>(initialGroups);
  const [query, setQuery] = useState(initialQuery);
  const [minutes, setMinutes] = useState(60);
  const [started, start, starting] = useActionState<QueryState, FormData>(startInsightsQuery, null);
  const [polled, setPolled] = useState<QueryState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll GetQueryResults until the query leaves Scheduled/Running.
  useEffect(() => {
    if (!started?.queryId) return;
    let cancelled = false;
    async function tick(id: string) {
      const r = await pollInsightsQuery(id);
      if (cancelled) return;
      setPolled(r);
      if (!r?.error && (r?.status === "Scheduled" || r?.status === "Running")) timer.current = setTimeout(() => tick(id), 800);
    }
    tick(started.queryId);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [started?.queryId]);

  const res = polled?.queryId === started?.queryId ? polled : null;
  const running = starting || (!!started?.queryId && (!res || res.status === "Scheduled" || res.status === "Running"));
  const error = started?.error ?? res?.error;

  return (
    <div className="space-y-4">
      <form action={start} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <fieldset className="min-w-72 flex-1">
            <legend className="mb-1 text-sm font-bold">Log groups</legend>
            <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-1 overflow-auto rounded border border-control-border bg-surface px-3 py-2">
              {groups.length === 0 && <span className="text-sm text-muted">No log groups.</span>}
              {groups.map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="groups"
                    value={g}
                    checked={selected.includes(g)}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, g] : selected.filter((x) => x !== g))}
                    className="accent-accent"
                  />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <span className="mb-1 block text-sm font-bold">Time range</span>
            <input type="hidden" name="minutes" value={minutes} />
            <div className="flex overflow-hidden rounded border border-control-border text-sm" role="group" aria-label="Time range">
              {RANGES.map(([m, l]) => (
                <button key={l} type="button" onClick={() => setMinutes(m)} className={m === minutes ? "bg-primary px-2.5 py-[3px] text-on-primary" : "px-2.5 py-[3px] hover:bg-hover"}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <textarea name="query" value={query} onChange={(e) => setQuery(e.target.value)} rows={6} spellCheck={false} aria-label="Query" className={cx(input, "font-mono text-[13px]")} />
        <div className="flex flex-wrap items-center gap-2">
          <button className={buttonClass("primary")} disabled={running || selected.length === 0}>{running ? "Running…" : "Run query"}</button>
          {running && started?.queryId && (
            <button type="button" className={buttonClass("normal")} onClick={() => stopInsightsQuery(started.queryId!)}>
              Cancel
            </button>
          )}
          {res?.stats && (
            <span className="text-sm text-muted">
              {res.status}: {res.stats.recordsMatched ?? 0} records matched, {res.stats.recordsScanned ?? 0} scanned, {Math.round(res.stats.bytesScanned ?? 0)} bytes
            </span>
          )}
        </div>
      </form>
      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      {res?.rows && (
        <div className="overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="border-b border-line px-3 py-1.5 font-medium text-muted">#</th>
                {res.fields?.map((f) => <th key={f} className="border-b border-line px-3 py-1.5 font-medium text-muted">{f}</th>)}
              </tr>
            </thead>
            <tbody>
              {res.rows.length === 0 && (
                <tr><td colSpan={(res.fields?.length ?? 0) + 1} className="px-3 py-4 text-center text-muted">No data found.</td></tr>
              )}
              {res.rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="border-b border-line-soft px-3 py-1.5 text-muted">{i + 1}</td>
                  {res.fields?.map((f) => <td key={f} className="border-b border-line-soft px-3 py-1.5 font-mono text-[13px] whitespace-pre-wrap break-all">{r[f]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Keep the editor contents for the "Save" form on the page. */}
      <input type="hidden" form="save-query" name="query" value={query} />
      {selected.map((g) => <input key={g} type="hidden" form="save-query" name="groups" value={g} />)}
    </div>
  );
}
