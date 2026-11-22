"use client";

import { useActionState } from "react";
import { testMetricFilter, type TestResult } from "./actions";
import { buttonClass } from "@/components/ui";

const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";

/** Try a filter pattern against sample log lines (TestMetricFilter). */
export function MetricFilterTester() {
  const [res, action, pending] = useActionState<TestResult, FormData>(testMetricFilter, null);
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-bold">Test pattern</h3>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-bold">Filter pattern to test</span>
          <input name="pattern" className={input} placeholder="ERROR" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold">Sample log events (one per line)</span>
          <textarea name="samples" rows={3} className={`${input} font-mono text-[13px]`} defaultValue={"ERROR something failed\nINFO all good"} />
        </label>
      </div>
      <button className={buttonClass("normal")} disabled={pending}>{pending ? "Testing…" : "Test pattern"}</button>
      {res?.error && <p className="text-sm text-danger">{res.error}</p>}
      {res?.matches && (
        <p className="text-sm">
          {res.matches.length} match{res.matches.length === 1 ? "" : "es"}
          {res.matches.length > 0 && ": "}
          {res.matches.map((m) => `line ${m.line}`).join(", ")}
        </p>
      )}
    </form>
  );
}
