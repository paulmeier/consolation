"use client";

import { useActionState, useState } from "react";
import { cryptoOp, type CryptoResult } from "./actions";
import { buttonClass, cx } from "@/components/ui";

type Op = { id: string; label: string; hint: string };

export function CryptoPlayground({ keyId, usage, signingAlgorithms, macAlgorithms }: { keyId: string; usage: string; signingAlgorithms: string[]; macAlgorithms: string[] }) {
  const ops: Op[] =
    usage === "SIGN_VERIFY"
      ? [
          { id: "sign", label: "Sign", hint: "Message to sign" },
          { id: "verify", label: "Verify", hint: "Message, then a line with ---, then the base64 signature" },
        ]
      : usage === "GENERATE_VERIFY_MAC"
        ? [
            { id: "mac", label: "Generate MAC", hint: "Message" },
            { id: "verifymac", label: "Verify MAC", hint: "Message, then a line with ---, then the base64 MAC" },
          ]
        : [
            { id: "encrypt", label: "Encrypt", hint: "Plaintext to encrypt" },
            { id: "decrypt", label: "Decrypt", hint: "Base64 ciphertext blob" },
            { id: "datakey", label: "Generate data key", hint: "No input needed" },
          ];
  const [op, setOp] = useState(ops[0].id);
  const algs = usage === "SIGN_VERIFY" ? signingAlgorithms : usage === "GENERATE_VERIFY_MAC" ? macAlgorithms : [];
  const current = ops.find((o) => o.id === op)!;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-line">
        {ops.map((o) => (
          <button key={o.id} type="button" onClick={() => setOp(o.id)} className={cx("-mb-px border-b-[3px] px-3 py-1.5 text-sm font-semibold", op === o.id ? "border-accent text-accent" : "border-transparent hover:text-accent")}>
            {o.label}
          </button>
        ))}
      </div>
      {/* keyed by operation so each one starts with a fresh result */}
      <OpForm key={op} keyId={keyId} op={current} algs={algs} />
    </div>
  );
}

function OpForm({ keyId, op, algs }: { keyId: string; op: Op; algs: string[] }) {
  const [res, action, pending] = useActionState<CryptoResult, FormData>(cryptoOp, null);
  const current = op;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={keyId} />
      <input type="hidden" name="op" value={op.id} />
      {algs.length > 0 && (
        <select name="alg" className="rounded border border-control-border bg-surface px-3 py-[4px]">
          {algs.map((a) => <option key={a}>{a}</option>)}
        </select>
      )}
      {op.id !== "datakey" && (
        <textarea name="input" rows={5} placeholder={current.hint} spellCheck={false} className="w-full rounded border border-control-border bg-surface p-3 font-mono text-[13px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none" />
      )}
      <div className="flex justify-end">
        <button className={buttonClass("primary")} disabled={pending}>{pending ? "Running…" : current.label}</button>
      </div>
      {res?.error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{res.error}</p>}
      {res?.output !== undefined && (
        <div>
          {res.detail && <p className="mb-1 text-sm text-muted">{res.detail}</p>}
          <pre className="max-h-60 overflow-auto rounded-lg bg-[#f6f6f5] p-3 font-mono text-[13px] whitespace-pre-wrap break-all">{res.output}</pre>
        </div>
      )}
    </form>
  );
}
