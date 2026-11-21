import { GetMetricDataCommand, type Dimension } from "@aws-sdk/client-cloudwatch";
import { aws, errorMessage } from "@/lib/emulator";

export type MetricSpec = { namespace: string; metric: string; dimensions?: Dimension[]; stat?: string; period?: number; label?: string };

const PALETTE = ["#295eff", "#c33d69", "#2ea597", "#8456ce", "#e07941", "#3759ce"];

/** Server-rendered SVG line chart for one or more metrics (GetMetricData). */
export async function MetricChart({ metrics, hours = 3, height = 220, title }: { metrics: MetricSpec[]; hours?: number; height?: number; title?: string }) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600_000);
  let series: { label: string; points: { t: number; v: number }[] }[] = [];
  let error: string | null = null;
  try {
    const { cloudwatch } = await aws();
    const r = await cloudwatch.send(
      new GetMetricDataCommand({
        StartTime: start,
        EndTime: end,
        MetricDataQueries: metrics.map((m, i) => ({
          Id: `m${i}`,
          Label: m.label ?? m.metric,
          MetricStat: { Metric: { Namespace: m.namespace, MetricName: m.metric, Dimensions: m.dimensions }, Period: m.period ?? 60, Stat: m.stat ?? "Average" },
        })),
      }),
    );
    series = (r.MetricDataResults ?? []).map((res) => ({
      label: res.Label ?? res.Id ?? "",
      points: (res.Timestamps ?? []).map((t, i) => ({ t: new Date(t).getTime(), v: res.Values?.[i] ?? 0 })).sort((a, b) => a.t - b.t),
    }));
  } catch (e) {
    error = errorMessage(e);
  }
  const W = 720;
  const H = height;
  const pad = { l: 48, r: 12, t: 12, b: 28 };
  const all = series.flatMap((s) => s.points);
  const maxV = Math.max(1, ...all.map((p) => p.v));
  const x = (t: number) => pad.l + ((t - start.getTime()) / (end.getTime() - start.getTime())) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxV) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxV);
  const fmtT = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <figure className="space-y-2">
      {title && <figcaption className="font-bold">{title}</figcaption>}
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Chart of ${series.map((s) => s.label).join(", ")}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-line" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" className="fill-subtle">{Math.round(v * 100) / 100}</text>
            </g>
          ))}
          {[0, 0.5, 1].map((f) => {
            const t = start.getTime() + f * (end.getTime() - start.getTime());
            return <text key={f} x={x(t)} y={H - 8} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} fontSize="11" className="fill-subtle">{fmtT(t)}</text>;
          })}
          {series.map((s, i) => (
            <g key={s.label + i}>
              <polyline fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="2" points={s.points.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")} />
              {s.points.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r="2.5" fill={PALETTE[i % PALETTE.length]} />)}
            </g>
          ))}
          {all.length === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" className="fill-subtle">No data available in the last {hours} hours</text>}
        </svg>
      )}
      {series.length > 0 && (
        <ul className="flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s, i) => (
            <li key={s.label + i} className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />{s.label}</li>
          ))}
        </ul>
      )}
    </figure>
  );
}
