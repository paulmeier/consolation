"use client";

import { useActionState } from "react";
import { sendSshPublicKey, type ConnectResult } from "../../actions";
import { buttonClass } from "@/components/ui";

const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";

export function InstanceConnect({ instance, az }: { instance: string; az?: string }) {
  const [res, action, pending] = useActionState<ConnectResult, FormData>(sendSshPublicKey, null);
  return (
    <form action={action} className="max-w-3xl space-y-3">
      <input type="hidden" name="instance" value={instance} />
      <input type="hidden" name="az" value={az ?? ""} />
      <label className="block text-sm">
        <span className="mb-1 block font-bold">Connection type</span>
        <span className="mr-4 inline-flex items-center gap-1.5"><input type="radio" name="serial" value="off" defaultChecked className="accent-accent" /> EC2 Instance Connect (SendSSHPublicKey)</span>
        <span className="inline-flex items-center gap-1.5"><input type="radio" name="serial" value="on" className="accent-accent" /> EC2 serial console (SendSerialConsoleSSHPublicKey)</span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-bold">Username</span>
        <input name="user" defaultValue="ec2-user" className={input} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-bold">SSH public key</span>
        <textarea name="key" rows={4} required className={`${input} font-mono text-[13px]`} placeholder="ssh-ed25519 AAAA... you@host" />
      </label>
      <button className={buttonClass("primary")} disabled={pending}>{pending ? "Sending…" : "Push key"}</button>
      {res?.ok && <p className="rounded-xl bg-success-soft p-3 text-sm text-success">{res.ok}</p>}
      {res?.error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{res.error}</p>}
    </form>
  );
}
