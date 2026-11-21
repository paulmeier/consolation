import { GetDashboardCommand } from "@aws-sdk/client-cloudwatch";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, ErrorAlert, Header, Textarea, buttonClass } from "@/components/ui";
import { MetricChart, type MetricSpec } from "../../chart";
import { deleteDashboards, saveDashboard } from "../../metric-actions";

type Widget = { type: string; width?: number; properties?: { title?: string; markdown?: string; stat?: string; period?: number; metrics?: (string | Record<string, unknown>)[][] } };

/** Converts CloudWatch dashboard metric arrays ([ns, name, dimName, dimValue, ...]) to chart specs. */
function toSpecs(w: Widget): MetricSpec[] {
  return (w.properties?.metrics ?? []).map((row) => {
    const parts = row.filter((x): x is string => typeof x === "string");
    const [namespace, metric, ...rest] = parts;
    const dimensions = [];
    for (let i = 0; i + 1 < rest.length; i += 2) dimensions.push({ Name: rest[i], Value: rest[i + 1] });
    return { namespace, metric, dimensions, stat: w.properties?.stat ?? "Average", period: w.properties?.period ?? 300 };
  });
}

export default async function DashboardPage({ params, searchParams }: PageProps<"/cloudwatch/dashboards/[name]">) {
  const name = decodeURIComponent((await params).name);
  const tab = (await searchParams).tab === "source" ? "source" : "view";
  let body = "";
  try {
    const { cloudwatch } = await aws();
    body = (await cloudwatch.send(new GetDashboardCommand({ DashboardName: name }))).DashboardBody ?? "{}";
  } catch (e) {
    return (<Page><Header variant="h1">{name}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  let widgets: Widget[] = [];
  try {
    widgets = JSON.parse(body).widgets ?? [];
  } catch {}
  const base = `/cloudwatch/dashboards/${encodeURIComponent(name)}`;
  return (
    <Page wide>
      <Header variant="h1" actions={<ConfirmAction values={[name]} extra={{ from: "detail" }} action={deleteDashboards} label="Delete" title="Delete dashboard" noun="dashboard" confirmWord="delete" />}>{name}</Header>
      <Tabs base={base} active={tab} tabs={[{ id: "view", label: "Dashboard" }, { id: "source", label: "Source" }]} />
      {tab === "view" ? (
        <div className="grid grid-cols-24 gap-4" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {widgets.map((w, i) => (
            <div key={i} style={{ gridColumn: `span ${Math.min(24, Math.max(6, w.width ?? 12))} / span ${Math.min(24, Math.max(6, w.width ?? 12))}` }}>
              <Container header={w.type === "metric" ? <Header variant="h3">{w.properties?.title ?? "Metric"}</Header> : undefined}>
                {w.type === "metric" ? (
                  <MetricChart metrics={toSpecs(w)} height={180} />
                ) : w.type === "text" ? (
                  <div className="space-y-1 whitespace-pre-wrap">{(w.properties?.markdown ?? "").split("\n").map((l, j) => (l.startsWith("# ") ? <h3 key={j} className="text-lg font-bold">{l.slice(2)}</h3> : <p key={j}>{l}</p>))}</div>
                ) : (
                  <p className="text-sm text-muted">Widget type “{w.type}” is not rendered by Consolation yet.</p>
                )}
              </Container>
            </div>
          ))}
          {widgets.length === 0 && <p className="col-span-full text-muted">This dashboard has no widgets.</p>}
        </div>
      ) : (
        <Container header={<Header description="Dashboard body JSON (PutDashboard).">Source</Header>}>
          <form action={saveDashboard} className="space-y-3">
            <input type="hidden" name="name" value={name} />
            <Textarea name="body" rows={22} defaultValue={(() => { try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; } })()} spellCheck={false} />
            <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
          </form>
        </Container>
      )}
    </Page>
  );
}
