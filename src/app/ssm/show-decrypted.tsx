"use client";

import { useActionState } from "react";
import { showDecrypted, type ValueResult } from "./actions";
import { buttonClass } from "@/components/ui";

export function ShowDecrypted({ name }: { name: string }) {
  const [res, action, pending] = useActionState<ValueResult, FormData>(showDecrypted, null);
  if (res?.value !== undefined) return <pre className="max-h-80 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap break-all">{res.value}</pre>;
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="name" value={name} />
      <span className="font-mono tracking-widest text-muted">••••••••••</span>
      <button className={buttonClass("normal")} disabled={pending}>{pending ? "Decrypting…" : "Show decrypted value"}</button>
      {res?.error && <span className="text-sm text-danger">{res.error}</span>}
    </form>
  );
}
