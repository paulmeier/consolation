"use client";

import { useActionState, useState } from "react";
import { deleteMessage, pollMessages, sendMessage, type SqsResult } from "./actions";
import { buttonClass } from "@/components/ui";

export function MessagesPanel({ name }: { name: string }) {
  const fifo = name.endsWith(".fifo");
  const [sent, send, sending] = useActionState<SqsResult, FormData>(sendMessage, null);
  const [polled, poll, polling] = useActionState<SqsResult, FormData>(pollMessages, null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <form action={send} className="space-y-3">
        <input type="hidden" name="name" value={name} />
        <h3 className="font-bold">Send message</h3>
        <label className="block text-sm font-bold">Message body</label>
        <textarea name="body" rows={6} required className={`${input} font-mono text-[13px]`} placeholder="Enter message body" />
        {fifo ? (
          <>
            <label className="block text-sm font-bold">Message group ID</label>
            <input name="group" required className={input} defaultValue="default" />
          </>
        ) : (
          <>
            <label className="block text-sm font-bold">Delivery delay (seconds)</label>
            <input name="delay" type="number" min={0} max={900} defaultValue={0} className={input} />
          </>
        )}
        <div className="flex justify-end">
          <button className={buttonClass("primary")} disabled={sending}>{sending ? "Sending…" : "Send message"}</button>
        </div>
        {sent?.sent && <p className="rounded-xl bg-success-soft p-3 text-sm text-success">{sent.sent}</p>}
        {sent?.error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{sent.error}</p>}
      </form>
      <div className="space-y-3">
        <form action={(fd) => { setDeleted(new Set()); poll(fd); }} className="flex items-end justify-between gap-3">
          <input type="hidden" name="name" value={name} />
          <div>
            <h3 className="font-bold">Receive messages</h3>
            <p className="text-sm text-muted">Polls up to 10 messages. Received messages become invisible for the visibility timeout.</p>
          </div>
          <button className={buttonClass("primary")} disabled={polling}>{polling ? "Polling…" : "Poll for messages"}</button>
        </form>
        {polled?.error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{polled.error}</p>}
        {polled?.messages && (
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="px-3 py-1.5 font-medium">ID</th>
                  <th className="px-3 py-1.5 font-medium">Body</th>
                  <th className="px-3 py-1.5 font-medium">Receive count</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {polled.messages.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-muted">No messages available.</td></tr>
                )}
                {polled.messages.filter((m) => !deleted.has(m.id)).map((m) => (
                  <tr key={m.id} className="border-b border-line-soft align-top">
                    <td className="px-3 py-2 font-mono text-xs break-all">{m.id}</td>
                    <td className="px-3 py-2"><pre className="max-h-40 overflow-auto font-mono text-[13px] whitespace-pre-wrap">{m.body}</pre></td>
                    <td className="px-3 py-2">{m.receiveCount ?? "-"}</td>
                    <td className="px-3 py-2">
                      <form action={async (fd) => { setDeleted((s) => new Set(s).add(m.id)); await deleteMessage(fd); }}>
                        <input type="hidden" name="name" value={name} />
                        <input type="hidden" name="receipt" value={m.receipt} />
                        <button className={buttonClass("normal")}>Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
