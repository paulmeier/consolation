import { DescribeAlarmHistoryCommand, DescribeAlarmsCommand } from "@aws-sdk/client-cloudwatch";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, KeyValue, buttonClass } from "@/components/ui";
import { MetricChart } from "../../chart";
import { deleteAlarms, setAlarmActions, setAlarmState } from "../../metric-actions";
import { alarmState, OPERATORS } from "../../alarm-shared";

export default async function AlarmPage({ params }: PageProps<"/cloudwatch/alarms/[name]">) {
  const name = decodeURIComponent((await params).name);
  const { cloudwatch } = await aws();
  let data;
  try {
    data = await Promise.all([
      cloudwatch.send(new DescribeAlarmsCommand({ AlarmNames: [name] })),
      cloudwatch.send(new DescribeAlarmHistoryCommand({ AlarmName: name, MaxRecords: 50 })).catch(() => ({ AlarmHistoryItems: [] })),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const a = data[0].MetricAlarms?.[0];
  if (!a) return (<Page><Header variant="h1">{name}</Header><ErrorAlert message="Alarm not found." /></Page>);
  const history = data[1].AlarmHistoryItems ?? [];
  const hidden = <input type="hidden" name="name" value={name} />;
  return (
    <Page wide>
      <Header
        variant="h1"
        actions={
          <>
            {(["OK", "ALARM", "INSUFFICIENT_DATA"] as const).filter((s) => s !== a.StateValue).map((s) => (
              <form key={s} action={setAlarmState}>{hidden}<input type="hidden" name="state" value={s} /><button className={buttonClass("normal")}>Set {s === "INSUFFICIENT_DATA" ? "insufficient data" : s}</button></form>
            ))}
            <form action={setAlarmActions}>{hidden}<input type="hidden" name="enable" value={a.ActionsEnabled ? "false" : "true"} /><button className={buttonClass("normal")}>{a.ActionsEnabled ? "Disable actions" : "Enable actions"}</button></form>
            <ConfirmAction values={[name]} extra={{ from: "detail" }} action={deleteAlarms} label="Delete" title="Delete alarm" noun="alarm" confirmWord="delete" />
          </>
        }
      >
        {name}
      </Header>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
        <Container header={<Header>Graph</Header>}>
          <MetricChart metrics={[{ namespace: a.Namespace!, metric: a.MetricName!, dimensions: a.Dimensions, stat: a.Statistic ?? "Average", period: a.Period }]} />
          <p className="mt-2 text-sm text-muted">Threshold: {a.MetricName} {OPERATORS.find(([v]) => v === a.ComparisonOperator)?.[2]} {a.Threshold}</p>
        </Container>
        <Container header={<Header>Details</Header>}>
          <KeyValue
            columns={1}
            items={[
              { label: "State", value: alarmState(a.StateValue) },
              { label: "State reason", value: a.StateReason ?? "-" },
              { label: "Namespace / metric", value: `${a.Namespace} / ${a.MetricName}` },
              { label: "Dimensions", value: (a.Dimensions ?? []).map((d) => `${d.Name}=${d.Value}`).join(", ") || "-" },
              { label: "Statistic / period", value: `${a.Statistic} / ${a.Period}s` },
              { label: "Missing data treatment", value: a.TreatMissingData ?? "missing" },
              { label: "Actions", value: (a.AlarmActions ?? []).join(", ") || "-" },
              { label: "ARN", value: <span className="font-mono text-xs break-all">{a.AlarmArn}</span> },
            ]}
          />
        </Container>
      </div>
      <Container noPadding header={<Header counter={history.length}>History</Header>}>
        <Table
          rows={history}
          rowKey={(h) => `${h.Timestamp?.toISOString()}-${h.HistorySummary}`}
          columns={[
            { header: "Date", cell: (h) => formatDate(h.Timestamp) },
            { header: "Type", cell: (h) => h.HistoryItemType },
            { header: "Description", cell: (h) => h.HistorySummary },
          ]}
          empty={<EmptyState title="No history" />}
        />
      </Container>
    </Page>
  );
}
