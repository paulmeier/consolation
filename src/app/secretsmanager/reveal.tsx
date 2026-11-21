"use client";

import { useActionState } from "react";
import { revealSecret, type RevealResult } from "./actions";
import { buttonClass } from "@/components/ui";

function asObject(v: string): Record<string, unknown> | null {
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

/** "Retrieve secret value" button; the value is fetched only on demand. */
export function RevealSecret({ name, versionId, label = "Retrieve secret value" }: { name: string; versionId?: string; label?: string }) {
  const [res, action, pending] = useActionState<RevealResult, FormData>(revealSecret, null);
  if (res?.value !== undefined) {
    const obj = res.binary ? null : asObject(res.value);
    return (
      <div className="space-y-2">
        {obj ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5 font-medium">Secret key</th>
                <th className="py-1.5 font-medium">Secret value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(obj).map(([k, v]) => (
                <tr key={k} className="border-b border-line-soft">
                  <td className="py-1.5 pr-4 font-mono text-[13px]">{k}</td>
                  <td className="py-1.5 font-mono text-[13px] break-all">{typeof v === "string" ? v : JSON.stringify(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre className="max-h-80 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap break-all">
            {res.binary ? `(binary, base64) ${res.value}` : res.value}
          </pre>
        )}
        <p className="text-xs text-subtle">Version {res.version}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="name" value={name} />
      {versionId && <input type="hidden" name="versionId" value={versionId} />}
      <button className={buttonClass("normal")} disabled={pending}>{pending ? "Retrieving…" : label}</button>
      {res?.error && <p className="text-sm text-danger">{res.error}</p>}
    </form>
  );
}
