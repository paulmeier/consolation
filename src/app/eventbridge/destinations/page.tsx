import { ListApiDestinationsCommand, ListConnectionsCommand, type ApiDestination, type Connection } from "@aws-sdk/client-eventbridge";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { createConnection, createDestination, deleteConnections, deleteDestinations } from "../actions";

export const metadata = { title: "API destinations | EventBridge" };

export default async function DestinationsPage() {
  let conns: Connection[] = [];
  let dests: ApiDestination[] = [];
  let error: string | null = null;
  try {
    const { events } = await aws();
    [conns, dests] = await Promise.all([
      events.send(new ListConnectionsCommand({ Limit: 100 })).then((r) => r.Connections ?? []),
      events.send(new ListApiDestinationsCommand({ Limit: 100 })).then((r) => r.ApiDestinations ?? []),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            counter={dests.length}
            info
            description="An API destination is an HTTP endpoint you can use as the target of a rule."
            actions={
              <>
                <ConfirmAction formId="dest-form" action={deleteDestinations} label="Delete" title="Delete API destination" noun="API destination" confirmWord="delete" />
                <ModalButton label="Create API destination" title="Create API destination" variant="primary">
                  <form action={createDestination} className="space-y-4">
                    <FormField label="Name"><Input name="name" required pattern="[A-Za-z0-9._\-]+" autoFocus /></FormField>
                    <FormField label="API destination endpoint"><Input name="endpoint" type="url" required placeholder="https://example.test/webhook" /></FormField>
                    <FormField label="HTTP method"><Select name="method">{["POST", "GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => <option key={m}>{m}</option>)}</Select></FormField>
                    <FormField label="Connection"><Select name="connection" required>{conns.map((c) => <option key={c.ConnectionArn} value={c.ConnectionArn}>{c.Name}</option>)}</Select></FormField>
                    <FormField label="Invocation rate limit per second"><Input name="rate" type="number" min={1} defaultValue={300} /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!conns.length}>Create</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            API destinations
          </Header>
        }
      >
        <form id="dest-form" />
        <Table
          formId="dest-form"
          selection="multi"
          rows={dests}
          rowKey={(d) => d.Name!}
          columns={[
            { header: "Name", cell: (d) => d.Name },
            { header: "Endpoint", cell: (d) => <span className="break-all">{d.InvocationEndpoint}</span> },
            { header: "Method", cell: (d) => d.HttpMethod },
            { header: "State", cell: (d) => d.ApiDestinationState },
            { header: "Created", cell: (d) => formatDate(d.CreationTime) },
          ]}
          empty={<EmptyState title="No API destinations" description={conns.length ? undefined : "Create a connection first."} />}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={conns.length}
            description="A connection holds the authorization used to call an API destination."
            actions={
              <>
                <ConfirmAction formId="conn-form" action={deleteConnections} label="Delete" title="Delete connection" noun="connection" confirmWord="delete" />
                <ModalButton label="Create connection" title="Create connection (API key)">
                  <form action={createConnection} className="space-y-4">
                    <FormField label="Name"><Input name="name" required pattern="[A-Za-z0-9._\-]+" autoFocus /></FormField>
                    <FormField label="API key name"><Input name="keyName" required defaultValue="x-api-key" /></FormField>
                    <FormField label="Value" description="Use a test value; it is stored in the emulator."><Input name="keyValue" required /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Connections
          </Header>
        }
      >
        <form id="conn-form" />
        <Table
          formId="conn-form"
          selection="multi"
          rows={conns}
          rowKey={(c) => c.Name!}
          columns={[
            { header: "Name", cell: (c) => c.Name },
            { header: "Authorization type", cell: (c) => c.AuthorizationType },
            { header: "State", cell: (c) => c.ConnectionState },
            { header: "Created", cell: (c) => formatDate(c.CreationTime) },
          ]}
          empty={<EmptyState title="No connections" />}
        />
      </Container>
    </Page>
  );
}
