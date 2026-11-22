import Link from "next/link";
import {
  DescribeExportTasksCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  DescribeMetricFiltersCommand,
  DescribeSubscriptionFiltersCommand,
  FilterLogEventsCommand,
  GetDataProtectionPolicyCommand,
  GetLogEventsCommand,
  ListLogAnomalyDetectorsCommand,
  ListTagsForResourceCommand,
  type AnomalyDetector,
  type ExportTask,
  type FilteredLogEvent,
  type LogGroup,
  type LogStream,
  type MetricFilter,
  type OutputLogEvent,
  type SubscriptionFilter,
} from "@aws-sdk/client-cloudwatch-logs";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { aws, errorMessage, REGION, EMULATOR_ACCOUNT } from "@/lib/emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Table } from "@/components/table";
import { TagsPanel } from "@/components/tags";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import {
  cancelExportTask,
  createAnomalyDetector,
  createLogStream,
  deleteAnomalyDetectors,
  deleteLogStreams,
  deleteMetricFilters,
  deleteSubscriptionFilters,
  editLogGroup,
  exportToS3,
  putLogDataProtection,
  putLogEvent,
  putMetricFilter,
  putSubscriptionFilter,
  tagLogGroup,
  untagLogGroup,
} from "../../actions";
import { MetricFilterTester } from "../../metric-filter-tester";

const FORM = "streams-form";
const TABS = [
  { id: "streams", label: "Log streams" },
  { id: "metric-filters", label: "Metric filters" },
  { id: "subscription-filters", label: "Subscription filters" },
  { id: "anomaly", label: "Anomaly detection" },
  { id: "data-protection", label: "Data protection" },
  { id: "exports", label: "Export tasks" },
  { id: "tags", label: "Tags" },
];
const RETENTION = [0, 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653];
const RANGES: [number, string][] = [
  [5, "5m"],
  [30, "30m"],
  [60, "1h"],
  [720, "12h"],
  [1440, "1d"],
  [10080, "1w"],
  [0, "All"],
];

const DEFAULT_DP = {
  Name: "data-protection-policy",
  Description: "",
  Version: "2021-06-01",
  Statement: [
    { Sid: "audit-policy", DataIdentifier: ["arn:aws:dataprotection::aws:data-identifier/EmailAddress"], Operation: { Audit: { FindingsDestination: {} } } },
    { Sid: "redact-policy", DataIdentifier: ["arn:aws:dataprotection::aws:data-identifier/EmailAddress"], Operation: { Deidentify: { MaskConfig: {} } } },
  ],
};

function qs(base: string, params: Record<string, string | number | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

function RangePicker({ href, active }: { href: (m: number) => string; active: number }) {
  return (
    <div className="flex overflow-hidden rounded border border-control-border text-sm" role="group" aria-label="Time range">
      {RANGES.map(([m, l]) => (
        <Link key={l} href={href(m)} className={m === active ? "bg-primary px-2.5 py-[3px] text-on-primary" : "px-2.5 py-[3px] hover:bg-hover"}>
          {l}
        </Link>
      ))}
    </div>
  );
}

function EventsTable({ rows, showStream }: { rows: (OutputLogEvent & { logStreamName?: string })[]; showStream?: boolean }) {
  return (
    <Table
      id="events-table"
      rows={rows}
      rowKey={(e) => `${e.timestamp}-${e.ingestionTime}-${e.logStreamName ?? ""}-${e.message?.slice(0, 40)}`}
      filterText={(e) => e.message ?? ""}
      columns={[
        { header: "Timestamp", width: "260px", cell: (e) => <span className="font-mono text-[13px]">{new Date(e.timestamp!).toISOString()}</span>, sortValue: (e) => e.timestamp },
        ...(showStream ? [{ header: "Log stream", width: "200px", cell: (e: { logStreamName?: string }) => <span className="break-all">{e.logStreamName}</span> }] : []),
        { header: "Message", cell: (e) => <pre className="font-mono text-[13px] whitespace-pre-wrap break-all">{e.message}</pre> },
      ]}
      empty={<EmptyState title="No events" description="No events in this time range." />}
    />
  );
}

export default async function GroupPage({ params, searchParams }: PageProps<"/cloudwatch/log-groups/[group]">) {
  const group = decodeURIComponent((await params).group);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const base = `/cloudwatch/log-groups/${encodeURIComponent(group)}`;
  const { logs, s3 } = await aws();
  const groupField = <input type="hidden" name="group" value={group} />;

  // --- One stream's events, with relative time range and forward/backward paging ---
  const stream = str("stream");
  if (stream !== undefined) {
    const minutes = Number(str("minutes") ?? 0);
    const token = str("token");
    let events: OutputLogEvent[] = [];
    let next: string | undefined;
    let prev: string | undefined;
    let error: string | null = null;
    try {
      const r = await logs.send(
        new GetLogEventsCommand({
          logGroupName: group,
          logStreamName: stream,
          startFromHead: !token,
          limit: 200,
          ...(minutes > 0 ? { startTime: new Date().getTime() - minutes * 60_000 } : {}),
          ...(token ? { nextToken: token } : {}),
        }),
      );
      events = r.events ?? [];
      next = r.nextForwardToken !== token ? r.nextForwardToken : undefined;
      prev = r.nextBackwardToken !== token ? r.nextBackwardToken : undefined;
    } catch (e) {
      error = errorMessage(e);
    }
    const here = (extra: Record<string, string | number | undefined>) => qs(base, { stream, minutes: minutes || undefined, ...extra });
    return (
      <Page>
        <Header variant="h1">{stream}</Header>
        <p className="-mt-4 text-sm">
          <Link href={base} className="underline-link">{group}</Link>
        </p>
        {error && <ErrorAlert message={error} />}
        <Container
          noPadding
          header={
            <div className="space-y-3">
              <Header
                counter={events.length}
                actions={
                  <>
                    <LinkButton href={here({})} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                    <ModalButton label="Put log events" title="Put log events" variant="primary">
                      <form action={putLogEvent} className="space-y-4">
                        {groupField}
                        <input type="hidden" name="stream" value={stream} />
                        <FormField label="Messages" description="One event per line.">
                          <Textarea name="message" rows={6} required />
                        </FormField>
                        <div className="flex justify-end"><button className={buttonClass("primary")}>Put events</button></div>
                      </form>
                    </ModalButton>
                  </>
                }
              >
                Log events
              </Header>
              <div className="flex flex-wrap items-center gap-3">
                <RangePicker active={minutes} href={(m) => qs(base, { stream, minutes: m || undefined })} />
                <div className="min-w-60 flex-1"><TableFilter tableId="events-table" placeholder="Filter events" /></div>
                {prev && <LinkButton href={here({ token: prev })}>Load older</LinkButton>}
                {next && <LinkButton href={here({ token: next })}>Load newer</LinkButton>}
              </div>
            </div>
          }
        >
          <EventsTable rows={events} />
        </Container>
      </Page>
    );
  }

  // --- Search across all streams (FilterLogEvents) ---
  if (str("view") === "search") {
    const pattern = str("pattern") ?? "";
    const prefix = str("prefix") ?? "";
    const minutes = Number(str("minutes") ?? 60);
    const token = str("token");
    let events: FilteredLogEvent[] = [];
    let next: string | undefined;
    let error: string | null = null;
    try {
      const r = await logs.send(
        new FilterLogEventsCommand({
          logGroupName: group,
          filterPattern: pattern || undefined,
          logStreamNamePrefix: prefix || undefined,
          ...(minutes > 0 ? { startTime: new Date().getTime() - minutes * 60_000 } : {}),
          limit: 500,
          ...(token ? { nextToken: token } : {}),
        }),
      );
      events = r.events ?? [];
      next = r.nextToken;
    } catch (e) {
      error = errorMessage(e);
    }
    return (
      <Page>
        <Header variant="h1" description="Search events in every stream of the log group with a filter pattern.">Search log group</Header>
        <p className="-mt-4 text-sm">
          <Link href={base} className="underline-link">{group}</Link>
        </p>
        <Container>
          <form className="flex flex-wrap items-end gap-3" action={base}>
            <input type="hidden" name="view" value="search" />
            <input type="hidden" name="minutes" value={minutes} />
            <label className="min-w-72 flex-1 text-sm">
              <span className="mb-1 block font-bold">Filter pattern</span>
              <Input name="pattern" defaultValue={pattern} placeholder='ERROR, "exact phrase", { $.level = "error" }, [ip, user, ...]' />
            </label>
            <label className="w-56 text-sm">
              <span className="mb-1 block font-bold">Log stream prefix</span>
              <Input name="prefix" defaultValue={prefix} />
            </label>
            <button className={buttonClass("primary")}>Search</button>
          </form>
        </Container>
        {error && <ErrorAlert message={error} />}
        <Container
          noPadding
          header={
            <div className="space-y-3">
              <Header counter={events.length}>Events</Header>
              <div className="flex flex-wrap items-center gap-3">
                <RangePicker active={minutes} href={(m) => qs(base, { view: "search", pattern, prefix, minutes: m })} />
                {next && <LinkButton href={qs(base, { view: "search", pattern, prefix, minutes, token: next })}>Load more</LinkButton>}
              </div>
            </div>
          }
        >
          <EventsTable rows={events} showStream />
        </Container>
      </Page>
    );
  }

  // --- Log group details with tabs ---
  const t = str("tab") ?? "streams";
  const tab = TABS.some((x) => x.id === t) ? t : "streams";
  let info: LogGroup | undefined;
  const d = {
    streams: [] as LogStream[],
    metric: [] as MetricFilter[],
    subs: [] as SubscriptionFilter[],
    detectors: [] as AnomalyDetector[],
    dp: "",
    exports: [] as ExportTask[],
    buckets: [] as string[],
    tags: {} as Record<string, string>,
  };
  let error: string | null = null;
  try {
    info = ((await logs.send(new DescribeLogGroupsCommand({ logGroupNamePrefix: group }))).logGroups ?? []).find((g) => g.logGroupName === group);
    if (tab === "streams") d.streams = (await logs.send(new DescribeLogStreamsCommand({ logGroupName: group, orderBy: "LastEventTime", descending: true }))).logStreams ?? [];
    else if (tab === "metric-filters") d.metric = (await logs.send(new DescribeMetricFiltersCommand({ logGroupName: group }))).metricFilters ?? [];
    else if (tab === "subscription-filters") d.subs = (await logs.send(new DescribeSubscriptionFiltersCommand({ logGroupName: group }))).subscriptionFilters ?? [];
    else if (tab === "anomaly") d.detectors = (await logs.send(new ListLogAnomalyDetectorsCommand({ filterLogGroupArn: info?.arn?.replace(/:\*$/, "") }))).anomalyDetectors ?? [];
    else if (tab === "data-protection") d.dp = await logs.send(new GetDataProtectionPolicyCommand({ logGroupIdentifier: group })).then((r) => r.policyDocument ?? "").catch(() => "");
    else if (tab === "exports") d.exports = ((await logs.send(new DescribeExportTasksCommand({}))).exportTasks ?? []).filter((x) => x.logGroupName === group);
    else if (tab === "tags") d.tags = (await logs.send(new ListTagsForResourceCommand({ resourceArn: `arn:aws:logs:${REGION}:${EMULATOR_ACCOUNT}:log-group:${group}` }))).tags ?? {};
    d.buckets = ((await s3.send(new ListBucketsCommand({}))).Buckets ?? []).map((b) => b.Name!);
  } catch (e) {
    error = errorMessage(e);
  }
  const pretty = (s: string) => {
    try {
      return JSON.stringify(JSON.parse(s), null, 2);
    } catch {
      return s;
    }
  };

  let body: React.ReactNode = null;
  if (tab === "streams") {
    body = (
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={d.streams.length}
              actions={
                <>
                  <LinkButton href={base} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId={FORM} action={deleteLogStreams} extra={{ group }} label="Delete" title="Delete log stream(s)" noun="log stream" confirmWord="delete" />
                  <ModalButton label="Create log stream" title="Create log stream" variant="primary">
                    <form action={createLogStream} className="space-y-4">
                      {groupField}
                      <FormField label="Log stream name">
                        <Input name="name" required maxLength={512} autoFocus />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Log streams
            </Header>
            <TableFilter tableId="streams-table" placeholder="Filter log streams or try prefix search" />
          </div>
        }
      >
        <form id={FORM} />
        <Table
          id="streams-table"
          formId={FORM}
          selection="multi"
          rows={d.streams}
          rowKey={(s) => s.logStreamName!}
          filterText={(s) => s.logStreamName!}
          columns={[
            { header: "Log stream", cell: (s) => <Link className="underline-link" href={`${base}?stream=${encodeURIComponent(s.logStreamName!)}`}>{s.logStreamName}</Link> },
            { header: "Last event time", cell: (s) => formatDate(s.lastEventTimestamp) },
            { header: "Creation time", cell: (s) => formatDate(s.creationTime) },
          ]}
          empty={<EmptyState title="No log streams" />}
        />
      </Container>
    );
  } else if (tab === "metric-filters") {
    body = (
      <Container
        noPadding
        header={
          <Header
            counter={d.metric.length}
            description="Metric filters turn matching log events into CloudWatch metrics."
            actions={
              <>
                <ConfirmAction formId="mf-form" action={deleteMetricFilters} extra={{ group }} label="Delete" title="Delete metric filter" noun="metric filter" />
                <ModalButton label="Create metric filter" title="Create metric filter" variant="primary" size="lg">
                  <form action={putMetricFilter} className="space-y-4">
                    {groupField}
                    <FormField label="Filter pattern" description='For example ERROR, or { $.status = 500 } for JSON logs. Empty matches every event.'>
                      <Input name="pattern" />
                    </FormField>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="Filter name"><Input name="name" required /></FormField>
                      <FormField label="Metric namespace"><Input name="namespace" required defaultValue="LogMetrics" /></FormField>
                      <FormField label="Metric name"><Input name="metric" required /></FormField>
                      <FormField label="Metric value" constraint="A number, or a field like $.latency."><Input name="value" defaultValue="1" required /></FormField>
                      <FormField label={<>Default value <i className="font-normal text-muted">- optional</i></>}><Input name="default" type="number" step="any" /></FormField>
                      <FormField label="Unit">
                        <Select name="unit" defaultValue="">
                          <option value="">None</option>
                          {["Count", "Seconds", "Milliseconds", "Bytes", "Percent"].map((u) => <option key={u}>{u}</option>)}
                        </Select>
                      </FormField>
                    </div>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create metric filter</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Metric filters
          </Header>
        }
      >
        <form id="mf-form" />
        <Table
          formId="mf-form"
          selection="multi"
          rows={d.metric}
          rowKey={(m) => m.filterName!}
          columns={[
            { header: "Filter name", cell: (m) => m.filterName },
            { header: "Pattern", cell: (m) => <code className="font-mono text-[13px]">{m.filterPattern || "(all events)"}</code> },
            { header: "Metric", cell: (m) => m.metricTransformations?.map((x) => <Link key={x.metricName} className="text-accent hover:underline" href={`/cloudwatch/metrics?namespace=${encodeURIComponent(x.metricNamespace ?? "")}`}>{x.metricNamespace} / {x.metricName}</Link>) },
            { header: "Value", cell: (m) => m.metricTransformations?.[0]?.metricValue },
            { header: "Created", cell: (m) => formatDate(m.creationTime) },
          ]}
          empty={<EmptyState title="No metric filters" />}
        />
        <div className="border-t border-line px-5 py-4">
          <MetricFilterTester />
        </div>
      </Container>
    );
  } else if (tab === "subscription-filters") {
    body = (
      <Container
        noPadding
        header={
          <Header
            counter={d.subs.length}
            description="Stream matching events to Lambda, Kinesis Data Streams or Amazon Data Firehose. Up to two per log group."
            actions={
              <>
                <ConfirmAction formId="sf-form" action={deleteSubscriptionFilters} extra={{ group }} label="Delete" title="Delete subscription filter" noun="subscription filter" />
                <ModalButton label="Create subscription filter" title="Create subscription filter" variant="primary">
                  <form action={putSubscriptionFilter} className="space-y-4">
                    {groupField}
                    <FormField label="Destination ARN" description="A Lambda function, Kinesis data stream or Firehose delivery stream.">
                      <Input name="destination" required placeholder={`arn:aws:lambda:${REGION}:${EMULATOR_ACCOUNT}:function:my-fn`} />
                    </FormField>
                    <FormField label={<>IAM role ARN <i className="font-normal text-muted">- for Kinesis and Firehose</i></>}>
                      <Input name="role" />
                    </FormField>
                    <FormField label="Subscription filter name"><Input name="name" required /></FormField>
                    <FormField label="Filter pattern"><Input name="pattern" placeholder="Empty matches every event" /></FormField>
                    <FormField label="Distribution" description="For Kinesis destinations.">
                      <Select name="distribution" defaultValue="ByLogStream">
                        <option value="ByLogStream">By log stream</option>
                        <option value="Random">Random</option>
                      </Select>
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Start streaming</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Subscription filters
          </Header>
        }
      >
        <form id="sf-form" />
        <Table
          formId="sf-form"
          selection="multi"
          rows={d.subs}
          rowKey={(s) => s.filterName!}
          columns={[
            { header: "Filter name", cell: (s) => s.filterName },
            { header: "Pattern", cell: (s) => <code className="font-mono text-[13px]">{s.filterPattern || "(all events)"}</code> },
            { header: "Destination", cell: (s) => <span className="font-mono text-[13px] break-all">{s.destinationArn}</span> },
            { header: "Distribution", cell: (s) => s.distribution ?? "ByLogStream" },
            { header: "Created", cell: (s) => formatDate(s.creationTime) },
          ]}
          empty={<EmptyState title="No subscription filters" />}
        />
      </Container>
    );
  } else if (tab === "anomaly") {
    body = (
      <Container
        noPadding
        header={
          <Header
            counter={d.detectors.length}
            description="Anomaly detectors learn the usual log patterns and flag unusual ones."
            actions={
              <>
                <ConfirmAction formId="ad-form" action={deleteAnomalyDetectors} extra={{ group }} label="Delete" title="Delete anomaly detector" noun="anomaly detector" />
                <ModalButton label="Create anomaly detector" title="Create anomaly detector" variant="primary">
                  <form action={createAnomalyDetector} className="space-y-4">
                    {groupField}
                    <FormField label={<>Detector name <i className="font-normal text-muted">- optional</i></>}><Input name="name" /></FormField>
                    <FormField label="Evaluation frequency">
                      <Select name="frequency" defaultValue="FIFTEEN_MIN">
                        {["FIVE_MIN", "TEN_MIN", "FIFTEEN_MIN", "THIRTY_MIN", "ONE_HOUR"].map((f) => <option key={f}>{f}</option>)}
                      </Select>
                    </FormField>
                    <FormField label={<>Filter pattern <i className="font-normal text-muted">- optional</i></>}><Input name="pattern" /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create anomaly detector</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Anomaly detection
          </Header>
        }
      >
        <form id="ad-form" />
        <Table
          formId="ad-form"
          selection="multi"
          rows={d.detectors}
          rowKey={(a) => a.anomalyDetectorArn!}
          columns={[
            { header: "Detector", cell: (a) => a.detectorName || a.anomalyDetectorArn?.split(":").pop() },
            { header: "Status", cell: (a) => <StatusIndicator type={a.anomalyDetectorStatus === "FAILED" ? "error" : a.anomalyDetectorStatus === "PAUSED" ? "stopped" : "success"}>{a.anomalyDetectorStatus ?? "INITIALIZING"}</StatusIndicator> },
            { header: "Frequency", cell: (a) => a.evaluationFrequency },
            { header: "Created", cell: (a) => formatDate(a.creationTimeStamp) },
          ]}
          empty={<EmptyState title="No anomaly detectors" />}
        />
      </Container>
    );
  } else if (tab === "data-protection") {
    body = (
      <Container
        header={
          <Header
            description="Audit and mask sensitive data such as email addresses in this log group."
            actions={
              <ModalButton label={d.dp ? "Edit" : "Create policy"} title="Data protection policy" size="lg">
                <form action={putLogDataProtection} className="space-y-4">
                  {groupField}
                  <FormField label="Policy (JSON)" description="Leave empty to delete the policy.">
                    <Textarea name="policy" rows={16} spellCheck={false} defaultValue={d.dp ? pretty(d.dp) : JSON.stringify(DEFAULT_DP, null, 2)} />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                </form>
              </ModalButton>
            }
          >
            Data protection policy
          </Header>
        }
      >
        <pre className="max-h-96 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap">{d.dp ? pretty(d.dp) : "No data protection policy."}</pre>
      </Container>
    );
  } else if (tab === "exports") {
    body = (
      <Container
        noPadding
        header={
          <Header counter={d.exports.length} description="Exports of this log group to Amazon S3.">
            Export tasks
          </Header>
        }
      >
        <Table
          rows={d.exports}
          rowKey={(x) => x.taskId!}
          columns={[
            { header: "Task ID", cell: (x) => <span className="font-mono text-[13px]">{x.taskId}</span> },
            { header: "Status", cell: (x) => <StatusIndicator type={x.status?.code === "COMPLETED" ? "success" : x.status?.code === "FAILED" ? "error" : x.status?.code === "CANCELLED" ? "stopped" : "pending"}>{x.status?.code}</StatusIndicator> },
            { header: "Destination", cell: (x) => `s3://${x.destination}/${x.destinationPrefix ?? ""}` },
            { header: "Range", cell: (x) => `${new Date(x.from ?? 0).toISOString().slice(0, 16)} – ${new Date(x.to ?? 0).toISOString().slice(0, 16)}` },
            {
              header: "",
              sortable: false,
              cell: (x) =>
                (x.status?.code === "PENDING" || x.status?.code === "RUNNING") && (
                  <form action={cancelExportTask}>
                    {groupField}
                    <input type="hidden" name="task" value={x.taskId} />
                    <button className={buttonClass("normal")}>Cancel</button>
                  </form>
                ),
            },
          ]}
          empty={<EmptyState title="No export tasks" description="Use Export data to Amazon S3 to create one." />}
        />
      </Container>
    );
  } else {
    body = <TagsPanel tags={Object.entries(d.tags).map(([Key, Value]) => ({ Key, Value }))} addAction={tagLogGroup} removeAction={untagLogGroup} hidden={{ group }} />;
  }

  return (
    <Page>
      <Header
        variant="h1"
        actions={
          <>
            <LinkButton href={`${base}?view=search`}>Search log group</LinkButton>
            <LinkButton href={`/cloudwatch/logs-insights?group=${encodeURIComponent(group)}`}>View in Logs Insights</LinkButton>
            <LinkButton href={`/cloudwatch/live-tail?group=${encodeURIComponent(group)}`}>Start tailing</LinkButton>
            <ModalButton label="Export data to Amazon S3" title="Export data to Amazon S3">
              <form action={exportToS3} className="space-y-4">
                {groupField}
                <FormField label="Time range">
                  <Select name="hours" defaultValue="24">
                    <option value="1">Last hour</option>
                    <option value="24">Last 24 hours</option>
                    <option value="168">Last 7 days</option>
                    <option value="720">Last 30 days</option>
                  </Select>
                </FormField>
                <FormField label={<>Stream prefix <i className="font-normal text-muted">- optional</i></>}><Input name="streamPrefix" /></FormField>
                <FormField label="S3 bucket">
                  <Select name="bucket" required>
                    {d.buckets.map((b) => <option key={b}>{b}</option>)}
                  </Select>
                </FormField>
                {d.buckets.length === 0 && <p className="text-sm text-muted">No buckets. Create one in Amazon S3 first.</p>}
                <FormField label={<>S3 bucket prefix <i className="font-normal text-muted">- optional</i></>}><Input name="prefix" /></FormField>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="grant" defaultChecked className="mt-1 accent-accent" />
                  <span>Add a bucket policy that lets CloudWatch Logs read the bucket ACL and write objects. CloudWatch Logs checks this before exporting.</span>
                </label>
                <div className="flex justify-end"><button className={buttonClass("primary")} disabled={d.buckets.length === 0}>Export</button></div>
              </form>
            </ModalButton>
            <ModalButton label="Edit" title={`Edit ${group}`}>
              <form action={editLogGroup} className="space-y-4">
                {groupField}
                <input type="hidden" name="hadKms" value={info?.kmsKeyId ?? ""} />
                <FormField label="Retention setting">
                  <Select name="retention" defaultValue={String(info?.retentionInDays ?? 0)}>
                    {RETENTION.map((r) => <option key={r} value={r}>{r === 0 ? "Never expire" : `${r} day${r === 1 ? "" : "s"}`}</option>)}
                  </Select>
                </FormField>
                <FormField label={<>KMS key ARN <i className="font-normal text-muted">- optional</i></>} description="Associate a KMS key to encrypt the log data. Clear it to disassociate.">
                  <Input name="kms" defaultValue={info?.kmsKeyId ?? ""} placeholder={`arn:aws:kms:${REGION}:${EMULATOR_ACCOUNT}:key/...`} />
                </FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
              </form>
            </ModalButton>
          </>
        }
      >
        {group}
      </Header>
      {error && <ErrorAlert message={error} />}
      <Container header={<Header>Log group details</Header>}>
        <KeyValue
          items={[
            { label: "Log class", value: info?.logGroupClass ?? "Standard" },
            { label: "Retention", value: info?.retentionInDays ? `${info.retentionInDays} days` : "Never expire" },
            { label: "Stored bytes", value: formatBytes(info?.storedBytes ?? 0) },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{info?.arn}</span> },
            { label: "Creation time", value: formatDate(info?.creationTime) },
            { label: "KMS key", value: info?.kmsKeyId ? <span className="font-mono text-[13px] break-all">{info.kmsKeyId}</span> : "-" },
            { label: "Metric filters", value: String(info?.metricFilterCount ?? 0) },
            { label: "Data protection", value: info?.dataProtectionStatus ?? "-" },
            { label: "Deletion protection", value: info?.deletionProtectionEnabled ? "On" : "Off" },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={TABS} />
      {body}
    </Page>
  );
}
