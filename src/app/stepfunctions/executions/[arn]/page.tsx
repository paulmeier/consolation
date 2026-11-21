import Link from "next/link";
import { DescribeExecutionCommand, DescribeStateMachineForExecutionCommand, GetExecutionHistoryCommand, type HistoryEvent } from "@aws-sdk/client-sfn";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, KeyValue, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { redriveExecution, stopExecution } from "../../actions";
import { AslGraph } from "../../graph";
import { execPath, execStatus, smPath } from "../../shared";

function pretty(s?: string) {
  if (!s) return "-";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function eventDetail(e: HistoryEvent) {
  const d =
    e.stateEnteredEventDetails ?? e.stateExitedEventDetails ?? e.executionStartedEventDetails ?? e.executionSucceededEventDetails ?? e.executionFailedEventDetails ?? e.taskFailedEventDetails ?? e.lambdaFunctionFailedEventDetails ?? e.taskSucceededEventDetails;
  return d ? JSON.stringify(d) : "";
}

export default async function ExecutionPage({ params }: PageProps<"/stepfunctions/executions/[arn]">) {
  const arn = decodeURIComponent((await params).arn);
  const { sfn } = await aws();
  let data;
  try {
    data = await Promise.all([
      sfn.send(new DescribeExecutionCommand({ executionArn: arn })),
      sfn.send(new GetExecutionHistoryCommand({ executionArn: arn, maxResults: 1000 })).catch(() => ({ events: [] as HistoryEvent[] })),
      sfn.send(new DescribeStateMachineForExecutionCommand({ executionArn: arn })).catch(() => null),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{arn.split(":").pop()}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [x, hist, sm] = data;
  const events = hist.events ?? [];
  // Per-state status for graph highlighting.
  const highlight: Record<string, "success" | "error" | "running"> = {};
  for (const e of events) {
    const n = e.stateEnteredEventDetails?.name ?? e.stateExitedEventDetails?.name;
    if (!n) continue;
    if (e.type?.endsWith("StateEntered")) highlight[n] = "running";
    if (e.type?.endsWith("StateExited")) highlight[n] = "success";
  }
  if (x.status === "FAILED") {
    const last = [...events].reverse().find((e) => e.stateEnteredEventDetails?.name);
    if (last?.stateEnteredEventDetails?.name) highlight[last.stateEnteredEventDetails.name] = "error";
  }
  return (
    <Page wide>
      <Header
        variant="h1"
        actions={
          <>
            <LinkButton href={execPath(arn)} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
            {x.status === "RUNNING" && <ConfirmAction values={[arn]} extra={{ arn }} action={stopExecution} label="Stop execution" title="Stop execution" noun="execution" confirmWord="stop" confirmLabel="Stop" />}
            {(x.status === "FAILED" || x.status === "ABORTED" || x.status === "TIMED_OUT") && (
              <form action={redriveExecution}><input type="hidden" name="arn" value={arn} /><button className={buttonClass("normal")}>Redrive</button></form>
            )}
          </>
        }
      >
        {x.name}
      </Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          items={[
            { label: "Execution status", value: execStatus(x.status) },
            { label: "State machine", value: <Link className="underline-link" href={smPath(x.stateMachineArn!)}>{x.stateMachineArn?.split(":").pop()}</Link> },
            { label: "Execution ARN", value: <span className="font-mono text-[13px] break-all">{arn}</span> },
            { label: "Start time", value: formatDate(x.startDate) },
            { label: "End time", value: formatDate(x.stopDate) },
            { label: "Redrive count", value: x.redriveCount ?? 0 },
            ...(x.error ? [{ label: "Error", value: <span className="text-danger">{x.error}</span> }, { label: "Cause", value: x.cause ?? "-" }] : []),
          ]}
        />
      </Container>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Container header={<Header>Input</Header>}><pre className="max-h-72 overflow-auto rounded-lg bg-[#f6f6f5] p-3 font-mono text-[13px]">{pretty(x.input)}</pre></Container>
        <Container header={<Header>Output</Header>}><pre className="max-h-72 overflow-auto rounded-lg bg-[#f6f6f5] p-3 font-mono text-[13px]">{pretty(x.output)}</pre></Container>
      </div>
      {sm?.definition && (
        <Container header={<Header description="Green: completed, blue: entered, red: failed.">Graph view</Header>}>
          <AslGraph definition={sm.definition} highlight={highlight} />
        </Container>
      )}
      <Container noPadding header={<Header counter={events.length}>Events</Header>}>
        <Table
          rows={events}
          rowKey={(e) => String(e.id)}
          columns={[
            { header: "ID", cell: (e) => e.id, sortValue: (e) => e.id ?? 0, width: "60px" },
            { header: "Type", cell: (e) => e.type },
            { header: "Step", cell: (e) => e.stateEnteredEventDetails?.name ?? e.stateExitedEventDetails?.name ?? "-" },
            { header: "Timestamp", cell: (e) => formatDate(e.timestamp) },
            { header: "Details", cell: (e) => <span className="font-mono text-xs break-all">{eventDetail(e).slice(0, 300)}</span> },
          ]}
          empty={<EmptyState title="No events" />}
        />
      </Container>
    </Page>
  );
}
