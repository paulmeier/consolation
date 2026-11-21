"use client";

import { useActionState } from "react";
import { presign, type PresignResult } from "./actions";
import { buttonClass } from "@/components/ui";

export function PresignForm({ bucket, objectKey }: { bucket: string; objectKey: string }) {
  const [res, action, pending] = useActionState<PresignResult, FormData>(presign, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bucket" value={bucket} />
      <input type="hidden" name="key" value={objectKey} />
      <label className="block text-sm font-bold">Time interval until the presigned URL expires (minutes)</label>
      <input name="minutes" type="number" min={1} max={10080} defaultValue={60} className="w-40 rounded border border-control-border px-3 py-[4px]" />
      <p className="text-xs text-muted">The URL points at the local emulator and stops working when the emulator restarts.</p>
      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={pending}>Create presigned URL</button></div>
      {res?.error && <p className="text-sm text-danger">{res.error}</p>}
      {res?.url && (
        <div className="space-y-1">
          <textarea readOnly rows={4} value={res.url} className="w-full rounded border border-line bg-[#f6f6f5] p-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <p className="text-xs text-muted">Expires {res.expires}</p>
        </div>
      )}
    </form>
  );
}
