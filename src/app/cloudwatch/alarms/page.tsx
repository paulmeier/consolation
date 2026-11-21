import Link from "next/link";
import { DescribeAlarmsCommand, type MetricAlarm } from "@aws-sdk/client-cloudwatch";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createAlarm, deleteAlarms } from "../metric-actions";
import { alarmState, OPERATORS } from "../alarm-shared";

export const metadata = { title: "Alarms | CloudWatch" };

export default async function AlarmsPage() {
  let alarms: MetricAlarm[] = [];
  let error: string | null = null;
  try {
    const { cloudwatch } = await aws();
    alarms = (await cloudwatch.send(new DescribeAlarmsCommand({ MaxRecords: 100 }))).MetricAlarms ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  const inAlarm = alarms.filter((a) => a.StateValue === "ALARM").length;
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={alarms.length}
              info
              description={inAlarm ? `${inAlarm} in alarm` : undefined}
              actions={
                <>
                  <LinkButton href="/cloudwatch/alarms" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="alarms-form" action={deleteAlarms} label="Delete" title="Delete alarms" noun="alarm" confirmWord="delete" />
                  <ModalButton label="Create alarm" title="Create alarm" variant="primary" size="lg">
                    <form action={createAlarm} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField label="Alarm name"><Input name="name" required maxLength={255} autoFocus /></FormField>
                        <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                        <FormField label="Namespace"><Input name="namespace" required defaultValue="Consolation/Demo" /></FormField>
                        <FormField label="Metric name"><Input name="metric" required defaultValue="RequestCount" /></FormField>
                        <FormField label="Dimensions" description="Name=Value, comma separated"><Input name="dimensions" defaultValue="Service=web" /></FormField>
                        <FormField label="Statistic"><Select name="statistic" defaultValue="Average">{["Average", "Sum", "Minimum", "Maximum", "SampleCount"].map((s) => <option key={s}>{s}</option>)}</Select></FormField>
                        <FormField label="Period (seconds)"><Select name="period" defaultValue="60">{["10", "30", "60", "300", "900", "3600"].map((s) => <option key={s}>{s}</option>)}</Select></FormField>
                        <FormField label="Datapoints to alarm"><Input name="evaluation" type="number" min={1} defaultValue={1} /></FormField>
                        <FormField label="Condition"><Select name="operator" defaultValue="GreaterThanThreshold">{OPERATORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></FormField>
                        <FormField label="Threshold"><Input name="threshold" type="number" step="any" required defaultValue={12} /></FormField>
                        <FormField label="Missing data treatment"><Select name="missing" defaultValue="missing">{["missing", "notBreaching", "breaching", "ignore"].map((s) => <option key={s}>{s}</option>)}</Select></FormField>
                        <FormField label={<>Alarm actions <i className="font-normal text-muted">- optional</i></>} description="SNS topic ARNs, comma separated"><Input name="actions" /></FormField>
                      </div>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create alarm</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Alarms
            </Header>
            <TableFilter tableId="alarms-table" placeholder="Search" />
          </div>
        }
      >
        <form id="alarms-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="alarms-table"
          formId="alarms-form"
          selection="multi"
          rows={alarms}
          rowKey={(a) => a.AlarmName!}
          filterText={(a) => `${a.AlarmName} ${a.StateValue} ${a.MetricName} ${a.Namespace}`}
          columns={[
            { header: "Name", cell: (a) => <Link className="underline-link" href={`/cloudwatch/alarms/${encodeURIComponent(a.AlarmName!)}`}>{a.AlarmName}</Link> },
            { header: "State", cell: (a) => alarmState(a.StateValue) },
            { header: "Last state update", cell: (a) => formatDate(a.StateUpdatedTimestamp) },
            { header: "Conditions", cell: (a) => `${a.MetricName} ${OPERATORS.find(([v]) => v === a.ComparisonOperator)?.[2] ?? a.ComparisonOperator} ${a.Threshold} for ${a.EvaluationPeriods} datapoints within ${((a.Period ?? 60) * (a.EvaluationPeriods ?? 1)) / 60} minutes` },
            { header: "Actions", cell: (a) => (a.ActionsEnabled ? (a.AlarmActions?.length ? "Actions enabled" : "No actions") : "Actions disabled") },
          ]}
          empty={<EmptyState title="No alarms" description="Create an alarm on a metric you publish." />}
        />
      </Container>
    </Page>
  );
}
