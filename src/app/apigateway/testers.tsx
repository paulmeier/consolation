"use client";

import { useActionState } from "react";
import { callStage, testInvoke, type TestResult } from "./actions";
import { buttonClass } from "@/components/ui";

const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";

function Result({ res }: { res: TestResult }) {
  if (!res) return null;
  if (res.error) return <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{res.error}</p>;
  let body = res.body ?? "";
  try {
    body = JSON.stringify(JSON.parse(body), null, 2);
  } catch {}
  const ok = (res.status ?? 0) < 400;
  return (
    <div className={`space-y-2 rounded-xl border-2 p-3 ${ok ? "border-success bg-success-soft" : "border-danger bg-danger-soft"}`}>
      <p className="text-sm font-bold">Status: {res.status} {res.latency !== undefined && <span className="font-normal text-muted">· {res.latency} ms</span>}</p>
      <pre className="max-h-60 overflow-auto rounded bg-surface p-2 font-mono text-[13px] whitespace-pre-wrap break-all">{body || "(empty body)"}</pre>
      {res.headers && Object.keys(res.headers).length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">Response headers</summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface p-2 font-mono text-xs">{Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
        </details>
      )}
      {res.log && (
        <details>
          <summary className="cursor-pointer text-sm">Logs</summary>
          <pre className="mt-1 max-h-60 overflow-auto rounded bg-surface p-2 font-mono text-xs whitespace-pre-wrap">{res.log}</pre>
        </details>
      )}
    </div>
  );
}

/** REST API method test (TestInvokeMethod) — no deployment needed. */
export function MethodTester({ api, resource, method, path }: { api: string; resource: string; method: string; path: string }) {
  const [res, action, pending] = useActionState<TestResult, FormData>(testInvoke, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="api" value={api} />
      <input type="hidden" name="resource" value={resource} />
      <input type="hidden" name="method" value={method} />
      <label className="block text-sm font-bold">Path and query string</label>
      <input name="path" defaultValue={path} className={input} />
      {!["GET", "HEAD", "DELETE"].includes(method) && (
        <>
          <label className="block text-sm font-bold">Request body</label>
          <textarea name="body" rows={4} className={`${input} font-mono text-[13px]`} />
        </>
      )}
      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={pending}>{pending ? "Testing…" : "Test"}</button></div>
      <Result res={res} />
    </form>
  );
}

/** Calls a deployed stage's invoke URL through the emulator. */
export function StageCaller({ api, stages }: { api: string; stages: string[] }) {
  const [res, action, pending] = useActionState<TestResult, FormData>(callStage, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="api" value={api} />
      <div className="grid grid-cols-[auto_auto_1fr] gap-2">
        <select name="stage" className={input}>{stages.map((s) => <option key={s}>{s}</option>)}</select>
        <select name="method" className={input}>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m}>{m}</option>)}</select>
        <input name="path" defaultValue="/" placeholder="/path?query=1" className={input} />
      </div>
      <input name="apiKey" placeholder="x-api-key (optional)" className={input} />
      <textarea name="body" rows={3} placeholder="Request body (optional)" className={`${input} font-mono text-[13px]`} />
      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={pending || stages.length === 0}>{pending ? "Calling…" : "Send request"}</button></div>
      <Result res={res} />
    </form>
  );
}
