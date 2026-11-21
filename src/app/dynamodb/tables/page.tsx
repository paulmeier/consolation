import Link from "next/link";
import { Suspense } from "react";
import { DescribeTableCommand, ListTablesCommand, type TableDescription } from "@aws-sdk/client-dynamodb";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { keyOf, tableStatus } from "../shared";
import { deleteTables } from "../actions";

export const metadata = { title: "Tables | DynamoDB" };
const FORM = "tables-form";

async function Tables() {
  let tables: TableDescription[] = [];
  let error: string | null = null;
  try {
    const { dynamodb } = await aws();
    const names = (await dynamodb.send(new ListTablesCommand({}))).TableNames ?? [];
    tables = await Promise.all(names.map(async (n) => (await dynamodb.send(new DescribeTableCommand({ TableName: n }))).Table!));
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={tables.length}
            info
            actions={
              <>
                <LinkButton href="/dynamodb/tables" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteTables} label="Delete" title="Delete table" noun="table" confirmWord="confirm" description="Deleting a table removes all of its items. This can't be undone." />
                <LinkButton href="/dynamodb/tables/create" variant="primary">Create table</LinkButton>
              </>
            }
          >
            Tables
          </Header>
          <TableFilter tableId="ddb-tables" placeholder="Find tables by table name" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="ddb-tables"
        formId={FORM}
        selection="multi"
        rows={tables}
        rowKey={(t) => t.TableName!}
        filterText={(t) => t.TableName!}
        columns={[
          { header: "Name", cell: (t) => <Link className="underline-link" href={`/dynamodb/tables/${encodeURIComponent(t.TableName!)}`}>{t.TableName}</Link> },
          { header: "Status", cell: (t) => tableStatus(t.TableStatus) },
          { header: "Partition key", cell: (t) => keyOf(t, "HASH") },
          { header: "Sort key", cell: (t) => keyOf(t, "RANGE") },
          { header: "Indexes", cell: (t) => (t.GlobalSecondaryIndexes?.length ?? 0) + (t.LocalSecondaryIndexes?.length ?? 0) },
          { header: "Capacity mode", cell: (t) => (t.BillingModeSummary?.BillingMode === "PAY_PER_REQUEST" ? "On-demand" : "Provisioned") },
          { header: "Item count", cell: (t) => t.ItemCount ?? 0 },
        ]}
        empty={<EmptyState title="No tables" description="You have not created any tables." action={<LinkButton href="/dynamodb/tables/create">Create table</LinkButton>} />}
      />
    </Container>
  );
}

export default function TablesPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Tables</Header>}>Loading tables…</Container>}>
        <Tables />
      </Suspense>
    </Page>
  );
}
