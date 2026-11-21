import { DescribeRuleCommand, ListTargetsByRuleCommand } from "@aws-sdk/client-eventbridge";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { addTarget, deleteRules, removeTargets, setRuleState, updatePattern } from "../../../actions";
import { PatternTester } from "../../../client-forms";

export default async function RulePage({ params }: PageProps<"/eventbridge/rules/[bus]/[name]">) {
  const p = await params;
  const bus = decodeURIComponent(p.bus);
  const name = decodeURIComponent(p.name);
  const { events } = await aws();
  let data;
  try {
    data = await Promise.all([events.send(new DescribeRuleCommand({ Name: name, EventBusName: bus })), events.send(new ListTargetsByRuleCommand({ Rule: name, EventBusName: bus })).catch(() => ({ Targets: [] }))]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [r, t] = data;
  const hidden = (
    <>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="bus" value={bus} />
    </>
  );
  let pattern = r.EventPattern ?? "";
  try {
    pattern = JSON.stringify(JSON.parse(pattern), null, 2);
  } catch {}
  const enabled = r.State === "ENABLED";
  return (
    <Page>
      <Header
        variant="h1"
        actions={
          <>
            <form action={setRuleState}>
              {hidden}
              <input type="hidden" name="enable" value={enabled ? "false" : "true"} />
              <button className={buttonClass("normal")}>{enabled ? "Disable" : "Enable"}</button>
            </form>
            <ConfirmAction values={[`${bus}|${name}`]} extra={{ from: "detail" }} action={deleteRules} label="Delete" title="Delete rule" noun="rule" confirmWord="delete" />
          </>
        }
      >
        {name}
      </Header>
      <Container header={<Header>Rule details</Header>}>
        <KeyValue
          items={[
            { label: "Rule name", value: name },
            { label: "Status", value: enabled ? <StatusIndicator type="success">Enabled</StatusIndicator> : <StatusIndicator type="stopped">Disabled</StatusIndicator> },
            { label: "Event bus name", value: bus },
            { label: "Type", value: r.ScheduleExpression ? "Scheduled" : "Standard" },
            { label: "Rule ARN", value: <span className="font-mono text-[13px] break-all">{r.Arn}</span> },
            { label: "Description", value: r.Description || "-" },
            ...(r.ScheduleExpression ? [{ label: "Schedule", value: r.ScheduleExpression }] : []),
          ]}
        />
      </Container>
      {!r.ScheduleExpression && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Container header={<Header>Event pattern</Header>}>
            <form action={updatePattern} className="space-y-3">
              {hidden}
              <input type="hidden" name="state" value={r.State} />
              <input type="hidden" name="description" value={r.Description ?? ""} />
              <Textarea name="pattern" rows={12} defaultValue={pattern} spellCheck={false} />
              <div className="flex justify-end"><button className={buttonClass("primary")}>Save pattern</button></div>
            </form>
          </Container>
          <Container header={<Header description="Check whether a sample event matches the saved pattern (TestEventPattern).">Test event pattern</Header>}>
            <PatternTester pattern={r.EventPattern ?? "{}"} />
          </Container>
        </div>
      )}
      <Container
        noPadding
        header={
          <Header
            counter={t.Targets?.length ?? 0}
            description="Delivery of matched events to targets depends on the emulator build; the v1.0.556 emulator accepts events but did not deliver them to an SQS target in testing."
            actions={
              <>
                <ConfirmAction formId="targets-form" action={removeTargets} extra={{ name, bus }} label="Remove" title="Remove targets" noun="target" confirmWord="remove" confirmLabel="Remove" />
                <ModalButton label="Add target" title="Add target" variant="primary">
                  <form action={addTarget} className="space-y-4">
                    {hidden}
                    <FormField label="Target ARN"><Input name="arn" required placeholder="arn:aws:lambda:us-east-1:000000000000:function:my-fn" autoFocus /></FormField>
                    <FormField label={<>Target ID <i className="font-normal text-muted">- optional</i></>}><Input name="id" /></FormField>
                    <FormField label={<>Constant input (JSON) <i className="font-normal text-muted">- optional</i></>} description="Replaces the matched event sent to the target."><Textarea name="input" rows={4} /></FormField>
                    <FormField label={<>Role ARN <i className="font-normal text-muted">- optional</i></>}><Input name="role" /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Add target</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Targets
          </Header>
        }
      >
        <form id="targets-form" />
        <Table
          formId="targets-form"
          selection="multi"
          rows={t.Targets ?? []}
          rowKey={(x) => x.Id!}
          columns={[
            { header: "Target ID", cell: (x) => x.Id },
            { header: "ARN", cell: (x) => <span className="font-mono text-[13px] break-all">{x.Arn}</span> },
            { header: "Input", cell: (x) => (x.Input ? <span className="font-mono text-xs">{x.Input}</span> : x.InputPath ? `Path ${x.InputPath}` : "Matched event") },
          ]}
          empty={<EmptyState title="No targets" description="Matching events are dropped until you add a target." />}
        />
      </Container>
    </Page>
  );
}
