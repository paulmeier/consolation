"use client";

import { useActionState } from "react";
import { createServiceCredential, type CredResult } from "./actions";
import { buttonClass } from "@/components/ui";

export function CreateServiceCredential({ user }: { user: string }) {
  const [res, action, pending] = useActionState<CredResult, FormData>(createServiceCredential, null);
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="user" value={user} />
        <label className="text-sm">
          <span className="mb-1 block font-bold">Service</span>
          <select name="service" className="rounded border border-control-border bg-surface px-3 py-[4px]">
            <option value="codecommit.amazonaws.com">AWS CodeCommit (HTTPS Git)</option>
            <option value="cassandra.amazonaws.com">Amazon Keyspaces</option>
            <option value="bedrock.amazonaws.com">Amazon Bedrock API key</option>
          </select>
        </label>
        <button className={buttonClass("normal")} disabled={pending}>{pending ? "Generating…" : "Generate credentials"}</button>
      </form>
      {res?.error && <p className="text-danger">{res.error}</p>}
      {res?.password && (
        <div className="rounded-xl border-2 border-success bg-success-soft p-4 text-sm">
          <p className="font-bold">Credentials generated</p>
          <p className="mt-1 text-muted">This is the only time the password can be viewed.</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[13px]">
            <dt className="text-muted">User name</dt>
            <dd className="break-all">{res.user}</dd>
            <dt className="text-muted">Password</dt>
            <dd className="break-all">{res.password}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
