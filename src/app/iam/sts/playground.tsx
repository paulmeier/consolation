"use client";

import { useActionState } from "react";
import { stsCall, type StsResult } from "../actions";
import { buttonClass } from "@/components/ui";

const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";

function Result({ res }: { res: StsResult }) {
  if (!res) return null;
  if (res.error) return <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{res.error}</p>;
  const entries = [...Object.entries(res.identity ?? {}), ...Object.entries(res.creds ?? {})];
  const env = res.creds
    ? `export AWS_ACCESS_KEY_ID=${res.creds.AccessKeyId}\nexport AWS_SECRET_ACCESS_KEY=${res.creds.SecretAccessKey}\nexport AWS_SESSION_TOKEN=${res.creds.SessionToken}`
    : null;
  return (
    <div className="space-y-3 rounded-xl border-2 border-success bg-success-soft p-4 text-sm">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono text-[13px] break-all">{v}</dd>
          </div>
        ))}
      </dl>
      {env && (
        <div>
          <p className="mb-1 font-bold">Use these credentials against the emulator</p>
          <pre className="overflow-auto rounded-lg bg-code p-3 font-mono text-xs whitespace-pre-wrap break-all">{env}</pre>
        </div>
      )}
    </div>
  );
}

export function StsPlayground({ roles }: { roles: { name: string; arn: string }[] }) {
  const [who, whoAction, whoPending] = useActionState<StsResult, FormData>(stsCall, null);
  const [assume, assumeAction, assumePending] = useActionState<StsResult, FormData>(stsCall, null);
  const [session, sessionAction, sessionPending] = useActionState<StsResult, FormData>(stsCall, null);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="space-y-3">
        <h3 className="font-bold">AssumeRole</h3>
        <form action={assumeAction} className="space-y-3">
          <input type="hidden" name="op" value="assume" />
          <label className="block text-sm font-bold">Role</label>
          <select name="role" className={input} required>
            {roles.map((r) => <option key={r.arn} value={r.arn}>{r.name}</option>)}
          </select>
          <label className="block text-sm font-bold">Role session name</label>
          <input name="session" className={input} defaultValue="consolation" pattern="[\w+=,.@\-]{2,64}" />
          <label className="block text-sm font-bold">Duration (seconds)</label>
          <input name="duration" type="number" min={900} max={43200} defaultValue={3600} className={input} />
          <label className="block text-sm font-bold">Session policy <i className="font-normal text-muted">- optional JSON</i></label>
          <textarea name="policy" rows={4} className={`${input} font-mono text-[13px]`} />
          <button className={buttonClass("primary")} disabled={assumePending || roles.length === 0}>{assumePending ? "Assuming…" : "Assume role"}</button>
          {roles.length === 0 && <p className="text-sm text-muted">Create a role first.</p>}
        </form>
        <Result res={assume} />
      </section>
      <section className="space-y-6">
        <div className="space-y-3">
          <h3 className="font-bold">GetCallerIdentity</h3>
          <form action={whoAction}>
            <input type="hidden" name="op" value="identity" />
            <button className={buttonClass("normal")} disabled={whoPending}>Who am I?</button>
          </form>
          <Result res={who} />
        </div>
        <div className="space-y-3">
          <h3 className="font-bold">GetSessionToken</h3>
          <form action={sessionAction} className="flex items-end gap-2">
            <input type="hidden" name="op" value="session" />
            <label className="text-sm">
              <span className="mb-1 block font-bold">Duration (seconds)</span>
              <input name="duration" type="number" min={900} max={129600} defaultValue={3600} className={input} />
            </label>
            <button className={buttonClass("normal")} disabled={sessionPending}>Get session token</button>
          </form>
          <Result res={session} />
        </div>
      </section>
    </div>
  );
}
