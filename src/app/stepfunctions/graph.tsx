/**
 * Static graph preview of an Amazon States Language definition: states laid out
 * top-to-bottom in reachability order, with Next/Choice/Default/Catch edges listed per node.
 */
type State = { Type?: string; Next?: string; End?: boolean; Default?: string; Choices?: { Next?: string }[]; Catch?: { Next?: string }[] };

const COLORS: Record<string, string> = {
  Task: "border-[#c925d1]",
  Pass: "border-line-strong",
  Choice: "border-[#ff9900]",
  Wait: "border-accent",
  Succeed: "border-success",
  Fail: "border-danger",
  Parallel: "border-[#7aa116]",
  Map: "border-[#7aa116]",
};

export function AslGraph({ definition, highlight }: { definition: string; highlight?: Record<string, "success" | "error" | "running"> }) {
  let def: { StartAt?: string; States?: Record<string, State> };
  try {
    def = JSON.parse(definition);
  } catch {
    return <p className="text-danger">The definition is not valid JSON.</p>;
  }
  const states = def.States ?? {};
  const order: string[] = [];
  const queue = def.StartAt ? [def.StartAt] : [];
  while (queue.length) {
    const n = queue.shift()!;
    if (order.includes(n) || !states[n]) continue;
    order.push(n);
    const s = states[n];
    [s.Next, s.Default, ...(s.Choices ?? []).map((c) => c.Next), ...(s.Catch ?? []).map((c) => c.Next)].forEach((x) => x && queue.push(x));
  }
  Object.keys(states).forEach((n) => !order.includes(n) && order.push(n));
  return (
    <ol className="flex flex-col items-center gap-0 py-2">
      <li className="rounded-full bg-hover px-3 py-1 text-xs text-muted">Start</li>
      {order.map((n) => {
        const s = states[n];
        const edges = [
          ...(s.Choices ?? []).map((c, i) => `rule ${i + 1} → ${c.Next}`),
          ...(s.Default ? [`default → ${s.Default}`] : []),
          ...(s.Catch ?? []).map((c) => `catch → ${c.Next}`),
        ];
        const hl = highlight?.[n];
        return (
          <li key={n} className="flex flex-col items-center">
            <span className="h-5 w-px bg-line-strong" />
            <div
              className={`min-w-56 rounded-lg border-2 bg-surface px-4 py-2 text-center shadow-card ${COLORS[s.Type ?? ""] ?? "border-line-strong"} ${hl === "success" ? "bg-success-soft" : hl === "error" ? "bg-danger-soft" : hl === "running" ? "bg-accent-soft" : ""}`}
            >
              <p className="font-bold">{n}</p>
              <p className="text-xs text-muted">{s.Type}</p>
              {edges.length > 0 && <p className="mt-1 text-xs text-subtle">{edges.join(" · ")}</p>}
            </div>
            {(s.End || s.Type === "Succeed" || s.Type === "Fail") && (
              <>
                <span className="h-5 w-px bg-line-strong" />
                <span className="rounded-full bg-hover px-3 py-1 text-xs text-muted">End</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
