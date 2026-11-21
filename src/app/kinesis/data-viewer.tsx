"use client";

import { useActionState } from "react";
import { putRecord, readRecords, type PutResult, type ReadResult } from "./actions";
import { buttonClass } from "@/components/ui";

const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";

export function DataViewer({ name, shards }: { name: string; shards: string[] }) {
  const [put, putAction, putting] = useActionState<PutResult, FormData>(putRecord, null);
  const [read, readAction, reading] = useActionState<ReadResult, FormData>(readRecords, null);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_2fr]">
      <form action={putAction} className="space-y-3">
        <input type="hidden" name="name" value={name} />
        <h3 className="font-bold">Put record</h3>
        <label className="block text-sm font-bold">Partition key</label>
        <input name="key" defaultValue="pk-1" className={input} />
        <label className="block text-sm font-bold">Data</label>
        <textarea name="data" rows={6} defaultValue={'{"hello":"kinesis"}'} className={`${input} font-mono text-[13px]`} />
        <div className="flex justify-end"><button className={buttonClass("primary")} disabled={putting}>{putting ? "Putting…" : "Put record"}</button></div>
        {put?.ok && <p className="rounded-xl bg-success-soft p-3 text-sm text-success break-all">{put.ok}</p>}
        {put?.error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{put.error}</p>}
      </form>
      <div className="space-y-3">
        <form action={readAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="name" value={name} />
          <div>
            <label className="block text-sm font-bold">Shard</label>
            <select name="shard" className={input}>{shards.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div>
            <label className="block text-sm font-bold">Starting position</label>
            <select name="position" defaultValue="TRIM_HORIZON" className={input}>
              <option value="TRIM_HORIZON">Trim horizon</option>
              <option value="LATEST">Latest</option>
              <option value="AT_TIMESTAMP">At timestamp (last hour)</option>
            </select>
          </div>
          <button className={buttonClass("primary")} disabled={reading}>{reading ? "Reading…" : "Get records"}</button>
        </form>
        {read?.error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{read.error}</p>}
        {read?.records && (
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-line text-muted"><th className="px-3 py-1.5 font-medium">Partition key</th><th className="px-3 py-1.5 font-medium">Data</th><th className="px-3 py-1.5 font-medium">Arrival</th><th className="px-3 py-1.5 font-medium">Sequence number</th></tr></thead>
              <tbody>
                {read.records.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted">No records in {read.shard}.</td></tr>}
                {read.records.map((r) => (
                  <tr key={r.seq} className="border-b border-line-soft align-top">
                    <td className="px-3 py-2">{r.key}</td>
                    <td className="px-3 py-2"><pre className="max-h-32 overflow-auto font-mono text-[13px] whitespace-pre-wrap break-all">{r.data}</pre></td>
                    <td className="px-3 py-2 text-xs">{r.at}</td>
                    <td className="px-3 py-2 font-mono text-xs break-all">{r.seq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
