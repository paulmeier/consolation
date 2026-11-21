import Link from "next/link";
import { Suspense } from "react";
import { ListStateMachinesCommand, type StateMachineListItem } from "@aws-sdk/client-sfn";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { deleteStateMachines } from "../actions";
import { smPath } from "../shared";

export const metadata = { title: "State machines | Step Functions" };
const FORM = "sm-form";

async function Machines() {
  const list: StateMachineListItem[] = [];
  let error: string | null = null;
  try {
    const { sfn } = await aws();
    let token: string | undefined;
    do {
      const r = await sfn.send(new ListStateMachinesCommand({ nextToken: token, maxResults: 100 }));
      list.push(...(r.stateMachines ?? []));
      token = r.nextToken;
    } while (token);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={list.length}
            info
            actions={
              <>
                <LinkButton href="/stepfunctions/state-machines" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteStateMachines} label="Delete" title="Delete state machine" noun="state machine" confirmWord="delete" description="Running executions are stopped when their state machine is deleted." />
                <LinkButton href="/stepfunctions/state-machines/create" variant="primary">Create state machine</LinkButton>
              </>
            }
          >
            State machines
          </Header>
          <TableFilter tableId="sm-table" placeholder="Search for state machines" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="sm-table"
        formId={FORM}
        selection="multi"
        rows={list}
        rowKey={(s) => s.stateMachineArn!}
        filterText={(s) => `${s.name} ${s.type}`}
        columns={[
          { header: "Name", cell: (s) => <Link className="underline-link" href={smPath(s.stateMachineArn!)}>{s.name}</Link> },
          { header: "Type", cell: (s) => (s.type === "EXPRESS" ? "Express" : "Standard") },
          { header: "Creation date", cell: (s) => formatDate(s.creationDate) },
        ]}
        empty={<EmptyState title="No state machines" description="You have not created any state machines." action={<LinkButton href="/stepfunctions/state-machines/create">Create state machine</LinkButton>} />}
      />
    </Container>
  );
}

export default function MachinesPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>State machines</Header>}>Loading…</Container>}>
        <Machines />
      </Suspense>
    </Page>
  );
}
