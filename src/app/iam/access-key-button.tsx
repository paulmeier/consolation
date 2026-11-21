"use client";

import { useActionState } from "react";
import { createAccessKey, type KeyResult } from "./actions";
import { buttonClass } from "@/components/ui";

export function CreateAccessKey({ user }: { user: string }) {
  const [res, action, pending] = useActionState<KeyResult, FormData>(createAccessKey, null);
  return (
    <div className="space-y-3">
      <form action={action}>
        <input type="hidden" name="user" value={user} />
        <button className={buttonClass("primary")} disabled={pending}>{pending ? "Creating…" : "Create access key"}</button>
      </form>
      {res?.error && <p className="text-danger">{res.error}</p>}
      {res?.secret && (
        <div className="rounded-xl border-2 border-success bg-success-soft p-4 text-sm">
          <p className="font-bold">Access key created</p>
          <p className="mt-1 text-muted">This is the only time the secret access key can be viewed. These keys are valid only against this emulator run.</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[13px]">
            <dt className="text-muted">Access key</dt>
            <dd className="break-all">{res.id}</dd>
            <dt className="text-muted">Secret access key</dt>
            <dd className="break-all">{res.secret}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
