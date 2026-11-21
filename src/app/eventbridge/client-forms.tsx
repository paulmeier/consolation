"use client";

import { useActionState } from "react";
import { sendEvent, testPattern, type SendResult, type TestResult } from "./actions";
import { buttonClass } from "@/components/ui";

const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";

export function SendEventForm({ buses }: { buses: string[] }) {
  const [res, action, pending] = useActionState<SendResult, FormData>(sendEvent, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-bold">Event bus</label>
      <select name="bus" className={input}>{buses.map((b) => <option key={b}>{b}</option>)}</select>
      <label className="block text-sm font-bold">Event source</label>
      <input name="source" required defaultValue="com.mycompany.myapp" className={input} />
      <label className="block text-sm font-bold">Detail type</label>
      <input name="detailType" required defaultValue="myDetailType" className={input} />
      <label className="block text-sm font-bold">Event detail</label>
      <textarea name="detail" rows={8} defaultValue={'{\n  "key1": "value1"\n}'} spellCheck={false} className={`${input} font-mono text-[13px]`} />
      <label className="block text-sm font-bold">Resources <i className="font-normal text-muted">- optional, comma separated ARNs</i></label>
      <input name="resources" className={input} />
      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={pending}>{pending ? "Sending…" : "Send"}</button></div>
      {res?.ok && <p className="rounded-xl bg-success-soft p-3 text-sm text-success">{res.ok}</p>}
      {res?.error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{res.error}</p>}
    </form>
  );
}

const SAMPLE_EVENT = JSON.stringify(
  { version: "0", id: "6a7e8feb-b491-4cf7-a9f1-bf3703467718", "detail-type": "myDetailType", source: "com.mycompany.myapp", account: "000000000000", time: "2026-01-01T00:00:00Z", region: "us-east-1", resources: [], detail: { key1: "value1" } },
  null,
  2,
);

export function PatternTester({ pattern }: { pattern: string }) {
  const [res, action, pending] = useActionState<TestResult, FormData>(testPattern, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="pattern" value={pattern} />
      <label className="block text-sm font-bold">Sample event</label>
      <textarea name="event" rows={12} defaultValue={SAMPLE_EVENT} spellCheck={false} className={`${input} font-mono text-[13px]`} />
      <div className="flex items-center justify-end gap-3">
        {res && (res.error ? <span className="text-sm text-danger">{res.error}</span> : <span className={`text-sm font-bold ${res.match ? "text-success" : "text-danger"}`}>{res.match ? "Sample event matched the event pattern." : "Sample event did not match the event pattern."}</span>)}
        <button className={buttonClass("normal")} disabled={pending}>Test pattern</button>
      </div>
    </form>
  );
}
