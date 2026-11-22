"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass, cx } from "@/components/ui";

type Ev = { timestamp?: number; group?: string; stream?: string; message?: string };
const input = "w-full rounded border border-control-border bg-surface px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none";
const MAX = 2000;

export function LiveTail({ groups, initial }: { groups: string[]; initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [pattern, setPattern] = useState("");
  const [streams, setStreams] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("Not started");
  const [events, setEvents] = useState<Ev[]>([]);
  const [paused, setPaused] = useState(false);
  const source = useRef<EventSource | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => () => source.current?.close(), []);

  function start() {
    source.current?.close();
    const q = new URLSearchParams();
    selected.forEach((g) => q.append("group", g));
    if (pattern) q.set("pattern", pattern);
    if (streams) q.set("streams", streams);
    const es = new EventSource(`/api/logs/tail?${q}`);
    source.current = es;
    setRunning(true);
    setStatus("Connecting…");
    es.addEventListener("start", () => setStatus("Tailing. New events appear as they arrive."));
    es.addEventListener("events", (m) => {
      const data = JSON.parse((m as MessageEvent).data) as { events: Ev[]; sampled: boolean };
      if (data.sampled) setStatus("Tailing (sampled: more than 500 events per second).");
      if (!pausedRef.current && data.events.length) setEvents((cur) => [...cur, ...data.events].slice(-MAX));
    });
    const finish = (text: string) => {
      es.close();
      setRunning(false);
      setStatus(text);
    };
    es.addEventListener("end", (m) => finish((JSON.parse((m as MessageEvent).data) as { reason: string }).reason));
    es.addEventListener("failure", (m) => finish(`Error: ${(JSON.parse((m as MessageEvent).data) as { message: string }).message}`));
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) finish("Disconnected.");
    };
  }

  function stop() {
    source.current?.close();
    setRunning(false);
    setStatus("Stopped.");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <fieldset className="lg:col-span-3">
          <legend className="mb-1 text-sm font-bold">Log groups (up to 10)</legend>
          <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-1 overflow-auto rounded border border-control-border bg-surface px-3 py-2">
            {groups.length === 0 && <span className="text-sm text-muted">No log groups.</span>}
            {groups.map((g) => (
              <label key={g} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  disabled={running}
                  checked={selected.includes(g)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, g].slice(0, 10) : selected.filter((x) => x !== g))}
                  className="accent-accent"
                />
                {g}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm lg:col-span-2">
          <span className="mb-1 block font-bold">Filter pattern</span>
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} disabled={running} className={input} placeholder="ERROR" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold">Log stream prefixes</span>
          <input value={streams} onChange={(e) => setStreams(e.target.value)} disabled={running} className={input} placeholder="comma separated" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <button type="button" className={buttonClass("primary")} onClick={stop}>Stop</button>
        ) : (
          <button type="button" className={buttonClass("primary")} onClick={start} disabled={selected.length === 0}>Start</button>
        )}
        <button type="button" className={buttonClass("normal")} onClick={() => setPaused(!paused)} disabled={!running}>{paused ? "Resume" : "Pause"}</button>
        <button type="button" className={buttonClass("normal")} onClick={() => setEvents([])}>Clear</button>
        <span role="status" aria-live="polite" className="text-sm text-muted">{status}</span>
        <span className="ml-auto text-sm text-muted">{events.length} events</span>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-xl border border-line bg-code">
        {events.length === 0 ? (
          <p className="p-4 text-sm text-muted">{running ? "Waiting for new log events…" : "Start tailing to stream new log events."}</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className={cx("align-top", i % 2 === 1 && "bg-stripe")}>
                  <td className="px-3 py-1 font-mono whitespace-nowrap text-subtle">{e.timestamp ? new Date(e.timestamp).toISOString() : ""}</td>
                  <td className="px-3 py-1 whitespace-nowrap text-muted">{e.group} / {e.stream}</td>
                  <td className="w-full px-3 py-1 font-mono whitespace-pre-wrap break-all">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
