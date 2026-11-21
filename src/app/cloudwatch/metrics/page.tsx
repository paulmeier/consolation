import Link from "next/link";
import { ListMetricsCommand, type Metric } from "@aws-sdk/client-cloudwatch";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { MetricChart } from "../chart";
import { putMetricData } from "../metric-actions";

export const metadata = { title: "All metrics | CloudWatch" };

const dimText = (m: Metric) => (m.Dimensions ?? []).map((d) => `${d.Name}=${d.Value}`).join(",");
const metricKey = (m: Metric) => `${m.Namespace}|${m.MetricName}|${dimText(m)}`;

export default async function MetricsPage({ searchParams }: PageProps<"/cloudwatch/metrics">) {
  const sp = await searchParams;
  const ns = typeof sp.ns === "string" ? sp.ns : "";
  const graphed = (Array.isArray(sp.m) ? sp.m : sp.m ? [sp.m] : []).map(String);
  const stat = String(sp.stat ?? "Average");
  const period = Number(sp.period ?? 60);
  const hours = Number(sp.hours ?? 3);
  let metrics: Metric[] = [];
  let error: string | null = null;
  try {
    const { cloudwatch } = await aws();
    let token: string | undefined;
    do {
      const r = await cloudwatch.send(new ListMetricsCommand({ NextToken: token, ...(ns ? { Namespace: ns } : {}) }));
      metrics.push(...(r.Metrics ?? []));
      token = r.NextToken;
    } while (token && metrics.length < 2000);
  } catch (e) {
    error = errorMessage(e);
  }
  const namespaces = Array.from(new Set(metrics.map((m) => m.Namespace!))).sort();
  if (ns) metrics = metrics.filter((m) => m.Namespace === ns);
  const specs = graphed.map((k) => {
    const [namespace, metric, d] = k.split("|");
    return { namespace, metric, stat, period, label: `${metric}${d ? ` (${d})` : ""}`, dimensions: d ? d.split(",").map((p) => ({ Name: p.split("=")[0], Value: p.split("=").slice(1).join("=") })) : [] };
  });
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (ns) p.set("ns", ns);
    graphed.forEach((g) => p.append("m", g));
    p.set("stat", stat);
    p.set("period", String(period));
    p.set("hours", String(hours));
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/cloudwatch/metrics?${p.toString()}`;
  };
  return (
    <Page wide>
      <Header
        variant="h1"
        info
        actions={
          <ModalButton label="Publish metric data" title="Publish metric data (PutMetricData)" variant="primary">
            <form action={putMetricData} className="space-y-4">
              <FormField label="Namespace"><Input name="namespace" required defaultValue="Consolation/Demo" /></FormField>
              <FormField label="Metric name"><Input name="metric" required defaultValue="RequestCount" /></FormField>
              <FormField label="Dimensions" description="Name=Value pairs, comma separated."><Input name="dimensions" defaultValue="Service=web" /></FormField>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Value"><Input name="value" type="number" step="any" defaultValue={10} /></FormField>
                <FormField label="Data points" description="One per minute, ending now."><Input name="points" type="number" min={1} max={60} defaultValue={30} /></FormField>
                <FormField label="Unit"><Select name="unit" defaultValue="Count">{["None", "Count", "Seconds", "Milliseconds", "Bytes", "Percent"].map((u) => <option key={u}>{u}</option>)}</Select></FormField>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="random" defaultChecked className="accent-accent" /> Randomize values (±50%)</label>
              <div className="flex justify-end"><button className={buttonClass("primary")}>Publish</button></div>
            </form>
          </ModalButton>
        }
      >
        Metrics
      </Header>
      {error && <ErrorAlert message={error} />}
      <Container
        header={
          <Header
            actions={
              <form className="flex flex-wrap items-center gap-2 text-sm">
                {ns && <input type="hidden" name="ns" value={ns} />}
                {graphed.map((g) => <input key={g} type="hidden" name="m" value={g} />)}
                <Select name="stat" defaultValue={stat} className="w-32">{["Average", "Sum", "Minimum", "Maximum", "SampleCount"].map((s) => <option key={s}>{s}</option>)}</Select>
                <Select name="period" defaultValue={String(period)} className="w-32">{[["60", "1 minute"], ["300", "5 minutes"], ["3600", "1 hour"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                <Select name="hours" defaultValue={String(hours)} className="w-28">{[["1", "1h"], ["3", "3h"], ["12", "12h"], ["24", "1d"], ["168", "1w"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                <button className={buttonClass("normal")}>Apply</button>
              </form>
            }
          >
            {specs.length ? "Graphed metrics" : "Untitled graph"}
          </Header>
        }
      >
        {specs.length ? <MetricChart metrics={specs} hours={hours} /> : <p className="py-10 text-center text-muted">Your CloudWatch graph is empty. Select some metrics below to appear here.</p>}
      </Container>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header counter={metrics.length} description={ns ? <>Namespace <b>{ns}</b> · <Link href="/cloudwatch/metrics" className="underline-link">All namespaces</Link></> : "Browse by namespace, then add metrics to the graph."}>
              {ns ? "Metrics" : "Browse"}
            </Header>
            {!ns && namespaces.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {namespaces.map((n) => (
                  <Link key={n} href={`/cloudwatch/metrics?ns=${encodeURIComponent(n)}`} className="rounded-xl border border-line-strong px-3 py-2 hover:border-accent">
                    <b>{n}</b>
                    <span className="block text-xs text-muted">{metrics.filter((m) => m.Namespace === n).length} metrics</span>
                  </Link>
                ))}
              </div>
            )}
            <TableFilter tableId="metrics-table" placeholder="Search for any metric, dimension or resource id" />
          </div>
        }
      >
        <Table
          id="metrics-table"
          rows={metrics}
          rowKey={metricKey}
          filterText={(m) => `${m.Namespace} ${m.MetricName} ${dimText(m)}`}
          columns={[
            { header: "Namespace", cell: (m) => m.Namespace },
            { header: "Metric name", cell: (m) => m.MetricName },
            { header: "Dimensions", cell: (m) => <span className="font-mono text-xs">{dimText(m) || "-"}</span> },
            {
              header: "",
              sortable: false,
              cell: (m) =>
                graphed.includes(metricKey(m)) ? (
                  <LinkButton href={(() => { const p = new URLSearchParams(qs({}).split("?")[1]); p.delete("m"); graphed.filter((g) => g !== metricKey(m)).forEach((g) => p.append("m", g)); return `/cloudwatch/metrics?${p}`; })()}>Remove</LinkButton>
                ) : (
                  <LinkButton href={`${qs({})}&m=${encodeURIComponent(metricKey(m))}`}>Add to graph</LinkButton>
                ),
            },
          ]}
          empty={<EmptyState title="No metrics" description="Publish metric data, or use services that emit metrics in the emulator." />}
        />
      </Container>
    </Page>
  );
}
