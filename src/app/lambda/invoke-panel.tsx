"use client";

import { useActionState, useRef, useSyncExternalStore } from "react";
import { invokeFunction, type InvokeResult } from "./actions";
import { buttonClass } from "@/components/ui";

const DEFAULT_EVENT = JSON.stringify({ key1: "value1", key2: "value2", key3: "value3" }, null, 2);

/** Saved test events live in this browser (localStorage), keyed by function name. */
function useSavedEvents(name: string) {
  const key = `consolation.lambda.events.${name}`;
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      window.addEventListener("consolation-events", cb);
      return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener("consolation-events", cb);
      };
    },
    () => {
      try {
        return localStorage.getItem(key) ?? "{}";
      } catch {
        return "{}";
      }
    },
    () => "{}",
  );
  const events = JSON.parse(raw) as Record<string, string>;
  const write = (next: Record<string, string>) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event("consolation-events"));
    } catch {
      /* storage unavailable */
    }
  };
  return { events, save: (n: string, body: string) => write({ ...events, [n]: body }), remove: (n: string) => write(Object.fromEntries(Object.entries(events).filter(([k]) => k !== n))) };
}

export function InvokePanel({ name }: { name: string }) {
  const [result, action, pending] = useActionState<InvokeResult, FormData>(invokeFunction, null);
  const { events, save, remove } = useSavedEvents(name);
  const area = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label className="space-y-1">
          <span className="block font-bold">Saved events</span>
          <select
            className="rounded border border-control-border bg-surface px-3 py-[4px]"
            defaultValue=""
            onChange={(e) => {
              if (area.current && e.target.value) area.current.value = events[e.target.value];
              if (nameRef.current) nameRef.current.value = e.target.value;
            }}
          >
            <option value="">Choose a saved event</option>
            {Object.keys(events).map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <input ref={nameRef} placeholder="Event name" aria-label="Event name" className="rounded border border-control-border bg-surface px-3 py-[4px]" />
        <button type="button" className={buttonClass("normal")} onClick={() => nameRef.current?.value && area.current && save(nameRef.current.value, area.current.value)}>Save</button>
        <button type="button" className={buttonClass("normal")} onClick={() => nameRef.current?.value && remove(nameRef.current.value)}>Delete</button>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="name" value={name} />
        <label className="block text-sm font-bold">Event JSON</label>
        <textarea
          ref={area}
          name="event"
          rows={10}
          spellCheck={false}
          defaultValue={DEFAULT_EVENT}
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
