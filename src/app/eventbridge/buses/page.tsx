import Link from "next/link";
import { ListEventBusesCommand, type EventBus } from "@aws-sdk/client-eventbridge";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, buttonClass } from "@/components/ui";
import { createBus, deleteBuses } from "../actions";

export const metadata = { title: "Event buses | EventBridge" };

export default async function BusesPage() {
  let buses: EventBus[] = [];
  let error: string | null = null;
  try {
    const { events } = await aws();
    buses = (await events.send(new ListEventBusesCommand({ Limit: 100 }))).EventBuses ?? [];
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
              counter={buses.length}
              info
              description="An event bus receives events from a source and routes them to rules associated with that event bus."
              actions={
                <>
                  <ConfirmAction formId="bus-form" action={deleteBuses} label="Delete" title="Delete event bus" noun="event bus" confirmWord="delete" description="Delete the rules on a custom bus before deleting it. The default bus can't be deleted." />
                  <ModalButton label="Create event bus" title="Create event bus" variant="primary">
                    <form action={createBus} className="space-y-4">
                      <FormField label="Name"><Input name="name" required maxLength={256} pattern="[A-Za-z0-9._\-]+" autoFocus /></FormField>
                      <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" maxLength={512} /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Event buses
            </Header>
            <TableFilter tableId="bus-table" placeholder="Find event buses" />
          </div>
        }
      >
        <form id="bus-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="bus-table"
          formId="bus-form"
          selection="single"
          rows={buses}
          rowKey={(b) => b.Name!}
          filterText={(b) => b.Name!}
          columns={[
            { header: "Name", cell: (b) => <Link className="underline-link" href={`/eventbridge/rules?bus=${encodeURIComponent(b.Name!)}`}>{b.Name}</Link> },
            { header: "ARN", cell: (b) => <span className="font-mono text-[13px]">{b.Arn}</span> },
            { header: "Description", cell: (b) => b.Description || "-" },
            { header: "Created", cell: (b) => formatDate(b.CreationTime) },
          ]}
          empty={<EmptyState title="No event buses" />}
        />
      </Container>
    </Page>
  );
}
