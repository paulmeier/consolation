"use client";

import { useActionState } from "react";
import { createKeyPair, type KeyPairResult } from "./actions";
import { buttonClass } from "@/components/ui";

export function CreateKeyPair() {
  const [res, action, pending] = useActionState<KeyPairResult, FormData>(createKeyPair, null);
  const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";
  if (res?.material) {
    const href = `data:application/x-pem-file;charset=utf-8,${encodeURIComponent(res.material)}`;
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-success-soft p-3 text-success">Successfully created key pair {res.name}.</p>
        <p className="text-sm text-muted">Download the private key now. You can&apos;t retrieve it again.</p>
        <a href={href} download={`${res.name}.pem`} className={buttonClass("primary")}>Download {res.name}.pem</a>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-bold">Name</label>
      <input name="name" required maxLength={255} className={input} autoFocus />
      <label className="block text-sm font-bold">Key pair type</label>
      <div className="flex gap-6">
        <label className="flex items-center gap-2"><input type="radio" name="type" value="rsa" defaultChecked className="accent-accent" /> RSA</label>
        <label className="flex items-center gap-2"><input type="radio" name="type" value="ed25519" className="accent-accent" /> ED25519</label>
      </div>
      {res?.error && <p className="text-danger">{res.error}</p>}
      <div className="flex justify-end">
        <button className={buttonClass("primary")} disabled={pending}>{pending ? "Creating…" : "Create key pair"}</button>
      </div>
    </form>
  );
}
