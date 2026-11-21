"use client";

import { useActionState } from "react";
import { invokeFunction, type InvokeResult } from "./actions";
import { buttonClass } from "@/components/ui";

export function InvokePanel({ name }: { name: string }) {
  const [result, action, pending] = useActionState<InvokeResult, FormData>(invokeFunction, null);
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="name" value={name} />
        <label className="block text-sm font-bold">Event JSON</label>
        <textarea
          name="event"
          rows={10}
          spellCheck={false}
          defaultValue={JSON.stringify({ key1: "value1", key2: "value2", key3: "value3" }, null, 2)}
          className="w-full rounded border border-control-border bg-surface p-3 font-mono text-[13px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
        />
        <div className="flex justify-end">
          <button className={buttonClass("primary")} disabled={pending}>
            {pending ? "Invoking…" : "Test"}
          </button>
        </div>
      </form>
      {result && (
        <div className={`rounded-xl border-2 p-4 ${result.ok ? "border-success bg-success-soft" : "border-danger bg-danger-soft"}`}>
          <p className="font-bold">
            {result.ok ? "Executing function: succeeded" : `Executing function: failed${result.functionError ? ` (${result.functionError})` : ""}`}
            {result.ms !== undefined && <span className="ml-2 font-normal text-muted">({result.ms} ms)</span>}
          </p>
          {result.error && <p className="mt-2 break-words text-danger">{result.error}</p>}
          {result.payload !== undefined && (
            <>
              <p className="mt-3 text-sm font-bold">Response</p>
              <pre className="mt-1 max-h-80 overflow-auto rounded bg-surface p-3 font-mono text-[13px] whitespace-pre-wrap">{result.payload || "null"}</pre>
            </>
          )}
          {result.log && (
            <>
              <p className="mt-3 text-sm font-bold">Log output</p>
              <pre className="mt-1 max-h-80 overflow-auto rounded bg-surface p-3 font-mono text-[13px] whitespace-pre-wrap">{result.log}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
