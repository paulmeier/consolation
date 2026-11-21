import { Suspense } from "react";
import { DescribeTableCommand, ScanCommand, type TableDescription } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { aws, errorMessage } from "@/lib/emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, Header, KeyValue, LinkButton, RefreshIcon, Textarea, buttonClass } from "@/components/ui";
import { keyOf, tableStatus } from "../../shared";
import { deleteItems, putItem } from "../../actions";

const FORM = "items-form";

function show(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v, (_k, x) => (x instanceof Set ? Array.from(x) : typeof x === "bigint" ? x.toString() : x));
  return String(v);
}

async function Items({ table, desc }: { table: string; desc: TableDescription }) {
  const keyNames = (desc.KeySchema ?? []).map((k) => k.AttributeName!);
  let items: Record<string, unknown>[] = [];
  let error: string | null = null;
  let scanned = 0;
  try {
    const { dynamodb } = await aws();
    const res = await dynamodb.send(new ScanCommand({ TableName: table, Limit: 200 }));
    items = (res.Items ?? []).map((i) => unmarshall(i));
    scanned = res.ScannedCount ?? items.length;
  } catch (e) {
    error = errorMessage(e);
  }
  const attrs = Array.from(new Set([...keyNames, ...items.flatMap((i) => Object.keys(i))]));
  const keyJson = (i: Record<string, unknown>) => JSON.stringify(Object.fromEntries(keyNames.map((k) => [k, i[k]])));
  const template = JSON.stringify(Object.fromEntries(keyNames.map((k) => [k, ""])), null, 2);
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={items.length}
            description={`Scan of ${table}. Items returned: ${items.length} · Items scanned: ${scanned}`}
            actions={
              <>
                <LinkButton href={`/dynamodb/tables/${encodeURIComponent(table)}?tab=items`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteItems} extra={{ table }} label="Delete items" title="Delete items" noun="item" confirmWord="delete" />
                <ModalButton label="Create item" title="Create item" variant="primary" size="lg">
                  <form action={putItem} className="space-y-3">
                    <input type="hidden" name="table" value={table} />
                    <p className="text-sm text-muted">Enter the item as plain JSON. Key attributes: {keyNames.join(", ")}. An existing item with the same key is replaced.</p>
                    <Textarea name="item" rows={14} defaultValue={template} spellCheck={false} />
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create item</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Items returned
          </Header>
          <TableFilter tableId="ddb-items" placeholder="Find items" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="ddb-items"
        formId={FORM}
        selection="multi"
        rows={items}
        rowKey={keyJson}
        filterText={(i) => JSON.stringify(i, (_k, x) => (x instanceof Set ? Array.from(x) : typeof x === "bigint" ? x.toString() : x))}
        columns={attrs.map((a) => ({
          header: <span>{a}{keyNames.includes(a) && <span className="ml-1 text-xs text-subtle">({keyNames.indexOf(a) === 0 ? "PK" : "SK"})</span>}</span>,
          cell: (i: Record<string, unknown>) => <span className="font-mono text-[13px]">{show(i[a])}</span>,
        }))}
        empty={<EmptyState title="No items" description="The table is empty." />}
      />
    </Container>
  );
}

export default async function TablePage({ params, searchParams }: PageProps<"/dynamodb/tables/[table]">) {
  const table = decodeURIComponent((await params).table);
  const tab = (await searchParams).tab === "items" ? "items" : "overview";
  let desc: TableDescription | undefined;
  try {
    const { dynamodb } = await aws();
    desc = (await dynamodb.send(new DescribeTableCommand({ TableName: table }))).Table;
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{table}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  return (
    <Page>
      <Header variant="h1" actions={<LinkButton href={`/dynamodb/tables/${encodeURIComponent(table)}?tab=items`} variant="primary">Explore table items</LinkButton>}>
        {table}
      </Header>
      <Tabs base={`/dynamodb/tables/${encodeURIComponent(table)}`} active={tab} tabs={[{ id: "overview", label: "Overview" }, { id: "items", label: "Explore items" }]} />
      {tab === "overview" ? (
        <Container header={<Header>General information</Header>}>
          <KeyValue
            items={[
              { label: "Partition key", value: keyOf(desc!, "HASH") },
              { label: "Sort key", value: keyOf(desc!, "RANGE") },
              { label: "Capacity mode", value: desc!.BillingModeSummary?.BillingMode === "PAY_PER_REQUEST" ? "On-demand" : "Provisioned" },
              { label: "Table status", value: tableStatus(desc!.TableStatus) },
              { label: "Item count", value: desc!.ItemCount ?? 0 },
              { label: "Table size", value: formatBytes(desc!.TableSizeBytes) },
              { label: "Creation date", value: formatDate(desc!.CreationDateTime) },
              { label: "Amazon Resource Name (ARN)", value: <span className="font-mono text-[13px] break-all">{desc!.TableArn}</span> },
              { label: "Stream", value: desc!.StreamSpecification?.StreamEnabled ? desc!.StreamSpecification.StreamViewType : "Off" },
            ]}
          />
        </Container>
      ) : (
        <Suspense fallback={<Container>Scanning…</Container>}>
          <Items table={table} desc={desc!} />
        </Suspense>
      )}
    </Page>
  );
}
