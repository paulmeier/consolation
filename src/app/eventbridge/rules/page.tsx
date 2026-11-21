import Link from "next/link";
import { ListEventBusesCommand, ListRulesCommand, type Rule } from "@aws-sdk/client-eventbridge";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon, StatusIndicator } from "@/components/ui";
import { deleteRules } from "../actions";

export const metadata = { title: "Rules | EventBridge" };

export default async function RulesPage({ searchParams }: PageProps<"/eventbridge/rules">) {
  const bus = String((await searchParams).bus ?? "default");
  let rules: Rule[] = [];
  let buses: string[] = ["default"];
  let error: string | null = null;
  try {
    const { events } = await aws();
    buses = ((await events.send(new ListEventBusesCommand({ Limit: 100 }))).EventBuses ?? []).map((b) => b.Name!);
    rules = (await events.send(new ListRulesCommand({ EventBusName: bus, Limit: 100 }))).Rules ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={rules.length}
              info
              description="A rule watches for specific types of events. When a matching event occurs, the event is routed to the targets associated with the rule."
              actions={
                <>
                  <LinkButton href={`/eventbridge/rules?bus=${encodeURIComponent(bus)}`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="rules-form" action={deleteRules} label="Delete" title="Delete rule" noun="rule" confirmWord="delete" description="Deleting a rule also removes its targets." />
                  <LinkButton href={`/eventbridge/rules/create?bus=${encodeURIComponent(bus)}`} variant="primary">Create rule</LinkButton>
                </>
              }
            >
              Rules
            </Header>
            <form className="flex items-center gap-2 text-sm">
              <label htmlFor="bus" className="font-bold">Event bus</label>
              <select id="bus" name="bus" defaultValue={bus} className="rounded border border-control-border bg-surface px-3 py-[4px]">
                {buses.map((b) => <option key={b}>{b}</option>)}
              </select>
              <button className="rounded border border-control-border px-3 py-[3px] hover:bg-hover">Select</button>
            </form>
            <TableFilter tableId="rules-table" placeholder="Search rules" />
          </div>
        }
      >
        <form id="rules-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="rules-table"
          formId="rules-form"
          selection="multi"
          rows={rules}
          rowKey={(r) => `${bus}|${r.Name}`}
          filterText={(r) => `${r.Name} ${r.Description ?? ""}`}
          columns={[
            { header: "Name", cell: (r) => <Link className="underline-link" href={`/eventbridge/rules/${encodeURIComponent(bus)}/${encodeURIComponent(r.Name!)}`}>{r.Name}</Link> },
            { header: "Status", cell: (r) => (r.State === "ENABLED" ? <StatusIndicator type="success">Enabled</StatusIndicator> : <StatusIndicator type="stopped">Disabled</StatusIndicator>) },
            { header: "Type", cell: (r) => (r.ScheduleExpression ? "Scheduled" : "Standard") },
            { header: "Description", cell: (r) => r.Description || "-" },
          ]}
          empty={<EmptyState title="No rules" description={`No rules on the ${bus} event bus.`} action={<LinkButton href={`/eventbridge/rules/create?bus=${encodeURIComponent(bus)}`}>Create rule</LinkButton>} />}
        />
      </Container>
    </Page>
  );
}
