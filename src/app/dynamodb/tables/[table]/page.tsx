import Link from "next/link";
import { Suspense } from "react";
import {
  DescribeContinuousBackupsCommand,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  ListBackupsCommand,
  ListTagsOfResourceCommand,
  QueryCommand,
  ScanCommand,
  type AttributeValue,
  type TableDescription,
} from "@aws-sdk/client-dynamodb";
import { DescribeStreamCommand, GetRecordsCommand, GetShardIteratorCommand } from "@aws-sdk/client-dynamodb-streams";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { aws, errorMessage } from "@/lib/emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TagsPanel } from "@/components/tags";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { keyOf, tableStatus } from "../../shared";
import { createBackup, createGsi, deleteBackups, deleteGsis, deleteItems, putItem, restoreBackup, setDeletionProtection, setPitr, setStream, setTtl, tagTable, untagTable } from "../../actions";
import { PartiqlEditor } from "../../partiql";

const FORM = "items-form";
const PAGE = 50;
type Sp = Record<string, string | string[] | undefined>;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

function show(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v, (_k, x) => (x instanceof Set ? Array.from(x) : typeof x === "bigint" ? x.toString() : x));
  return String(v);
}

function typed(value: string, type?: string): AttributeValue {
  return type === "N" ? { N: value } : type === "B" ? { B: Buffer.from(value, "base64") } : { S: value };
}

async function Items({ table, desc, sp }: { table: string; desc: TableDescription; sp: Sp }) {
  const keyNames = (desc.KeySchema ?? []).map((k) => k.AttributeName!);
  const mode = sp.mode === "query" ? "query" : "scan";
  const index = str(sp.index) ?? "";
  const indexes = [...(desc.GlobalSecondaryIndexes ?? []), ...(desc.LocalSecondaryIndexes ?? [])];
  const schema = index ? indexes.find((i) => i.IndexName === index)?.KeySchema ?? [] : desc.KeySchema ?? [];
  const pkName = schema.find((k) => k.KeyType === "HASH")?.AttributeName;
  const skName = schema.find((k) => k.KeyType === "RANGE")?.AttributeName;
  const typeOf = (n?: string) => desc.AttributeDefinitions?.find((a) => a.AttributeName === n)?.AttributeType;
  const start = str(sp.start);
  let items: Record<string, unknown>[] = [];
  let next: string | undefined;
  let error: string | null = null;
  let scanned = 0;
  try {
    const { dynamodb } = await aws();
    const ExclusiveStartKey = start ? (JSON.parse(Buffer.from(start, "base64url").toString()) as Record<string, AttributeValue>) : undefined;
    let res;
    if (mode === "query") {
      const pk = str(sp.pk) ?? "";
      if (!pk || !pkName) throw new Error("Enter a partition key value to run a query.");
      const op = str(sp.skOp) ?? "";
      const sk = str(sp.sk) ?? "";
      const names: Record<string, string> = { "#pk": pkName };
      const values: Record<string, AttributeValue> = { ":pk": typed(pk, typeOf(pkName)) };
      let cond = "#pk = :pk";
      if (skName && op && sk) {
        names["#sk"] = skName;
        values[":sk"] = typed(sk, typeOf(skName));
        if (op === "begins_with") cond += " AND begins_with(#sk, :sk)";
        else if (op === "between") {
          values[":sk2"] = typed(str(sp.sk2) ?? "", typeOf(skName));
          cond += " AND #sk BETWEEN :sk AND :sk2";
        } else cond += ` AND #sk ${op} :sk`;
      }
      res = await dynamodb.send(new QueryCommand({ TableName: table, IndexName: index || undefined, KeyConditionExpression: cond, ExpressionAttributeNames: names, ExpressionAttributeValues: values, Limit: PAGE, ExclusiveStartKey, ScanIndexForward: sp.order !== "desc" }));
    } else {
      res = await dynamodb.send(new ScanCommand({ TableName: table, IndexName: index || undefined, Limit: PAGE, ExclusiveStartKey }));
    }
    items = (res.Items ?? []).map((i) => unmarshall(i));
    scanned = res.ScannedCount ?? items.length;
    next = res.LastEvaluatedKey ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64url") : undefined;
  } catch (e) {
    error = errorMessage(e);
  }
  const attrs = Array.from(new Set([...keyNames, ...items.flatMap((i) => Object.keys(i))]));
  const keyJson = (i: Record<string, unknown>) => JSON.stringify(Object.fromEntries(keyNames.map((k) => [k, i[k]])));
  const template = JSON.stringify(Object.fromEntries(keyNames.map((k) => [k, ""])), null, 2);
  const base = `/dynamodb/tables/${encodeURIComponent(table)}`;
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    p.set("tab", "items");
    for (const k of ["mode", "index", "pk", "skOp", "sk", "sk2", "order"]) if (str(sp[k])) p.set(k, str(sp[k])!);
    for (const [k, v] of Object.entries(extra)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `${base}?${p}`;
  };
  const input = "rounded border border-control-border bg-surface px-3 py-[4px]";
  return (
    <>
      <Container header={<Header>Scan or query items</Header>}>
        <form className="space-y-3" action={base}>
          <input type="hidden" name="tab" value="items" />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2"><input type="radio" name="mode" value="scan" defaultChecked={mode === "scan"} className="accent-accent" /> Scan</label>
            <label className="flex items-center gap-2"><input type="radio" name="mode" value="query" defaultChecked={mode === "query"} className="accent-accent" /> Query</label>
            <select name="index" defaultValue={index} className={input}>
              <option value="">Table - {table}</option>
              {indexes.map((i) => <option key={i.IndexName} value={i.IndexName}>Index - {i.IndexName}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="space-y-1"><span className="block font-bold">{pkName ?? "Partition key"} (partition key)</span><input name="pk" defaultValue={str(sp.pk)} className={input} /></label>
            {skName && (
              <>
                <label className="space-y-1"><span className="block font-bold">{skName} (sort key)</span>
                  <select name="skOp" defaultValue={str(sp.skOp) ?? ""} className={input}>
                    <option value="">Any</option>
                    {["=", "<", "<=", ">", ">=", "begins_with", "between"].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <input name="sk" defaultValue={str(sp.sk)} placeholder="value" className={input} />
                <input name="sk2" defaultValue={str(sp.sk2)} placeholder="and (between)" className={input} />
              </>
            )}
            <select name="order" defaultValue={str(sp.order) ?? "asc"} className={input}><option value="asc">Ascending</option><option value="desc">Descending</option></select>
            <button className={buttonClass("primary")}>Run</button>
            <LinkButton href={`${base}?tab=items`} variant="link">Reset</LinkButton>
          </div>
        </form>
      </Container>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={items.length}
              description={`${mode === "query" ? "Query" : "Scan"}${index ? ` of index ${index}` : ""}: ${items.length} returned, ${scanned} scanned${start ? " (continued page)" : ""}.`}
              actions={
                <>
                  <LinkButton href={qs({})} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId={FORM} action={deleteItems} extra={{ table }} label="Delete items" title="Delete items" noun="item" confirmWord="delete" />
                  <ModalButton label="Create item" title="Create item" variant="primary" size="lg">
                    <form action={putItem} className="space-y-3">
                      <input type="hidden" name="table" value={table} />
                      <p className="text-sm text-muted">Plain JSON. Key attributes: {keyNames.join(", ")}. An item with the same key is replaced.</p>
                      <Textarea name="item" rows={14} defaultValue={template} spellCheck={false} />
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create item</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Items returned
            </Header>
            <TableFilter tableId="ddb-items" placeholder="Find items in this page" />
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
          filterText={(i) => show(i)}
          columns={[
            ...attrs.map((a) => ({
              header: <span>{a}{keyNames.includes(a) && <span className="ml-1 text-xs text-subtle">({keyNames.indexOf(a) === 0 ? "PK" : "SK"})</span>}</span>,
              cell: (i: Record<string, unknown>) => <span className="font-mono text-[13px]">{show(i[a])}</span>,
            })),
            {
              header: "",
              sortable: false,
              cell: (i: Record<string, unknown>) => (
                <ModalButton label="Edit" title="Edit item" size="lg">
                  <form action={putItem} className="space-y-3">
                    <input type="hidden" name="table" value={table} />
                    <p className="text-sm text-muted">Saving replaces the whole item. Changing a key attribute creates a new item.</p>
                    <Textarea name="item" rows={16} defaultValue={JSON.stringify(i, (_k, x) => (x instanceof Set ? Array.from(x) : typeof x === "bigint" ? x.toString() : x), 2)} spellCheck={false} />
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                  </form>
                </ModalButton>
              ),
            },
          ]}
          empty={<EmptyState title="No items" description={mode === "query" && !error ? "No items match the query." : "The table is empty."} />}
        />
        {(start || next) && (
          <div className="flex justify-between border-t border-line px-5 py-3 text-sm">
            {start ? <Link href={qs({ start: undefined })} className="underline-link">First page</Link> : <span />}
            {next && <Link href={qs({ start: next })} className="underline-link">Next page</Link>}
          </div>
        )}
      </Container>
    </>
  );
}

async function Indexes({ table, desc }: { table: string; desc: TableDescription }) {
  const rows = [
    ...(desc.GlobalSecondaryIndexes ?? []).map((g) => ({ name: g.IndexName!, kind: "Global", status: g.IndexStatus, keys: g.KeySchema, projection: g.Projection?.ProjectionType, items: g.ItemCount })),
    ...(desc.LocalSecondaryIndexes ?? []).map((l) => ({ name: l.IndexName!, kind: "Local", status: "ACTIVE", keys: l.KeySchema, projection: l.Projection?.ProjectionType, items: l.ItemCount })),
  ];
  const typeSelect = (n: string) => <Select name={n} defaultValue="S" className="w-28"><option value="S">String</option><option value="N">Number</option><option value="B">Binary</option></Select>;
  return (
    <Container
      noPadding
      header={
        <Header
          counter={rows.length}
          description="Local secondary indexes can only be created with the table."
          actions={
            <>
              <ConfirmAction formId="gsi-form" action={deleteGsis} extra={{ table }} label="Delete" title="Delete index" noun="index" confirmWord="confirm" />
              <ModalButton label="Create index" title="Create global secondary index" variant="primary">
                <form action={createGsi} className="space-y-4">
                  <input type="hidden" name="table" value={table} />
                  <FormField label="Partition key"><div className="flex gap-2"><Input name="pk" required />{typeSelect("pkType")}</div></FormField>
                  <FormField label={<>Sort key <i className="font-normal text-muted">- optional</i></>}><div className="flex gap-2"><Input name="sk" />{typeSelect("skType")}</div></FormField>
                  <FormField label="Index name"><Input name="name" required pattern="[A-Za-z0-9_.\-]{3,255}" /></FormField>
                  <p className="text-sm text-muted">Attribute projections: All.</p>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Create index</button></div>
                </form>
              </ModalButton>
            </>
          }
        >
          Indexes
        </Header>
      }
    >
      <form id="gsi-form" />
      <Table
        formId="gsi-form"
        selection="multi"
        rows={rows}
        rowKey={(r) => r.name}
        columns={[
          { header: "Name", cell: (r) => r.name },
          { header: "Type", cell: (r) => r.kind },
          { header: "Status", cell: (r) => tableStatus(r.status) },
          { header: "Partition key", cell: (r) => r.keys?.find((k) => k.KeyType === "HASH")?.AttributeName ?? "-" },
          { header: "Sort key", cell: (r) => r.keys?.find((k) => k.KeyType === "RANGE")?.AttributeName ?? "-" },
          { header: "Projected attributes", cell: (r) => r.projection ?? "-" },
          { header: "Item count", cell: (r) => r.items ?? 0 },
        ]}
        empty={<EmptyState title="No indexes" />}
      />
    </Container>
  );
}

async function Settings({ table, desc }: { table: string; desc: TableDescription }) {
  const { dynamodb } = await aws();
  const [ttl, pitr, tags] = await Promise.all([
    dynamodb.send(new DescribeTimeToLiveCommand({ TableName: table })).catch(() => null),
    dynamodb.send(new DescribeContinuousBackupsCommand({ TableName: table })).catch(() => null),
    dynamodb.send(new ListTagsOfResourceCommand({ ResourceArn: desc.TableArn })).catch(() => ({ Tags: [] })),
  ]);
  const ttlOn = ttl?.TimeToLiveDescription?.TimeToLiveStatus === "ENABLED" || ttl?.TimeToLiveDescription?.TimeToLiveStatus === "ENABLING";
  const pitrOn = pitr?.ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus === "ENABLED";
  const hidden = <input type="hidden" name="table" value={table} />;
  const on = (b: boolean) => (b ? <StatusIndicator type="success">On</StatusIndicator> : <StatusIndicator type="stopped">Off</StatusIndicator>);
  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Container header={<Header description="Automatically delete items after the epoch time in an attribute.">Time to Live (TTL)</Header>}>
          <form action={setTtl} className="space-y-3">
            {hidden}
            <KeyValue columns={1} items={[{ label: "Status", value: on(ttlOn) }, { label: "TTL attribute", value: ttl?.TimeToLiveDescription?.AttributeName ?? "-" }]} />
            <input type="hidden" name="enable" value={ttlOn ? "false" : "true"} />
            {!ttlOn && <FormField label="TTL attribute name"><Input name="attribute" defaultValue="expiresAt" /></FormField>}
            {ttlOn && <input type="hidden" name="attribute" value={ttl?.TimeToLiveDescription?.AttributeName ?? "ttl"} />}
            <div className="flex justify-end"><button className={buttonClass("normal")}>{ttlOn ? "Turn off" : "Turn on"}</button></div>
          </form>
        </Container>
        <Container header={<Header description="Continuous backups for restoring to any second in the retention period.">Point-in-time recovery</Header>}>
          <form action={setPitr} className="space-y-3">
            {hidden}
            <KeyValue columns={1} items={[{ label: "Status", value: on(pitrOn) }, { label: "Earliest restore", value: formatDate(pitr?.ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.EarliestRestorableDateTime) }]} />
            <input type="hidden" name="enable" value={pitrOn ? "false" : "true"} />
            <div className="flex justify-end"><button className={buttonClass("normal")}>{pitrOn ? "Turn off" : "Turn on"}</button></div>
          </form>
        </Container>
        <Container header={<Header description="Prevents the table from being deleted.">Deletion protection</Header>}>
          <form action={setDeletionProtection} className="space-y-3">
            {hidden}
            <KeyValue columns={1} items={[{ label: "Status", value: on(!!desc.DeletionProtectionEnabled) }]} />
            <input type="hidden" name="enable" value={desc.DeletionProtectionEnabled ? "false" : "true"} />
            <div className="flex justify-end"><button className={buttonClass("normal")}>{desc.DeletionProtectionEnabled ? "Turn off" : "Turn on"}</button></div>
          </form>
        </Container>
      </div>
      <TagsPanel tags={tags.Tags ?? []} addAction={tagTable} removeAction={untagTable} hidden={{ table, arn: desc.TableArn! }} />
    </>
  );
}

async function Backups({ table }: { table: string }) {
  const { dynamodb } = await aws();
  let backups: Awaited<ReturnType<typeof listBackups>> = [];
  let error: string | null = null;
  async function listBackups() {
    return (await dynamodb.send(new ListBackupsCommand({ TableName: table }))).BackupSummaries ?? [];
  }
  try {
    backups = await listBackups();
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <Header
          counter={backups.length}
          actions={
            <>
              <ConfirmAction formId="bk-form" action={deleteBackups} extra={{ table }} label="Delete" title="Delete backup" noun="backup" confirmWord="delete" />
              <ConfirmAction
                formId="bk-form"
                action={restoreBackup}
                extra={{ table }}
                label="Restore"
                title="Restore table from backup"
                noun="backup"
                confirmWord="restore"
                confirmLabel="Restore"
                fields={<div className="space-y-1"><label className="block text-sm font-bold">Name of restored table</label><Input name="target" required defaultValue={`${table}-restored`} /></div>}
              />
              <ModalButton label="Create backup" title="Create on-demand backup" variant="primary">
                <form action={createBackup} className="space-y-4">
                  <input type="hidden" name="table" value={table} />
                  <FormField label="Backup name"><Input name="name" required defaultValue={`${table}-backup`} pattern="[A-Za-z0-9_.\-]{3,255}" /></FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Create backup</button></div>
                </form>
              </ModalButton>
            </>
          }
        >
          Backups
        </Header>
      }
    >
      <form id="bk-form" />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        formId="bk-form"
        selection="single"
        rows={backups}
        rowKey={(b) => b.BackupArn!}
        columns={[
          { header: "Backup name", cell: (b) => b.BackupName },
          { header: "Status", cell: (b) => b.BackupStatus },
          { header: "Type", cell: (b) => b.BackupType },
          { header: "Size", cell: (b) => formatBytes(b.BackupSizeBytes), sortValue: (b) => b.BackupSizeBytes ?? 0 },
          { header: "Created", cell: (b) => formatDate(b.BackupCreationDateTime) },
        ]}
        empty={<EmptyState title="No backups" />}
      />
    </Container>
  );
}

async function Streams({ table, desc }: { table: string; desc: TableDescription }) {
  const enabled = !!desc.StreamSpecification?.StreamEnabled;
  let records: { id: string; event: string; when?: Date; keys: string; newImage: string; oldImage: string }[] = [];
  let error: string | null = null;
  if (enabled && desc.LatestStreamArn) {
    try {
      const { ddbStreams } = await aws();
      const s = await ddbStreams.send(new DescribeStreamCommand({ StreamArn: desc.LatestStreamArn }));
      for (const shard of s.StreamDescription?.Shards ?? []) {
        const it = await ddbStreams.send(new GetShardIteratorCommand({ StreamArn: desc.LatestStreamArn, ShardId: shard.ShardId, ShardIteratorType: "TRIM_HORIZON" }));
        const r = await ddbStreams.send(new GetRecordsCommand({ ShardIterator: it.ShardIterator, Limit: 100 }));
        for (const rec of r.Records ?? []) {
          const d = rec.dynamodb;
          records.push({
            id: rec.eventID ?? "",
            event: rec.eventName ?? "",
            when: d?.ApproximateCreationDateTime,
            keys: d?.Keys ? JSON.stringify(unmarshall(d.Keys as Record<string, AttributeValue>)) : "",
            newImage: d?.NewImage ? JSON.stringify(unmarshall(d.NewImage as Record<string, AttributeValue>)) : "",
            oldImage: d?.OldImage ? JSON.stringify(unmarshall(d.OldImage as Record<string, AttributeValue>)) : "",
          });
        }
      }
      records = records.reverse().slice(0, 200);
    } catch (e) {
      error = errorMessage(e);
    }
  }
  return (
    <>
      <Container header={<Header description="Captures item-level changes for consumers such as Lambda triggers.">DynamoDB stream details</Header>}>
        <form action={setStream} className="space-y-4">
          <input type="hidden" name="table" value={table} />
          <KeyValue items={[
            { label: "Status", value: enabled ? <StatusIndicator type="success">On</StatusIndicator> : <StatusIndicator type="stopped">Off</StatusIndicator> },
            { label: "View type", value: desc.StreamSpecification?.StreamViewType ?? "-" },
            { label: "Latest stream ARN", value: <span className="font-mono text-xs break-all">{desc.LatestStreamArn ?? "-"}</span> },
          ]} />
          {enabled ? (
            <><input type="hidden" name="view" value="" /><div className="flex justify-end"><button className={buttonClass("normal")}>Turn off</button></div></>
          ) : (
            <div className="flex items-end justify-end gap-2">
              <Select name="view" defaultValue="NEW_AND_OLD_IMAGES" className="w-64">{["KEYS_ONLY", "NEW_IMAGE", "OLD_IMAGE", "NEW_AND_OLD_IMAGES"].map((v) => <option key={v}>{v}</option>)}</Select>
              <button className={buttonClass("primary")}>Turn on</button>
            </div>
          )}
        </form>
      </Container>
      {enabled && (
        <Container noPadding header={<Header counter={records.length} description="Latest records from every shard (read with the DynamoDB Streams API).">Stream records</Header>}>
          {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
          <Table
            rows={records}
            rowKey={(r) => r.id}
            columns={[
              { header: "Event", cell: (r) => r.event },
              { header: "Time", cell: (r) => formatDate(r.when) },
              { header: "Keys", cell: (r) => <span className="font-mono text-xs">{r.keys}</span> },
              { header: "New image", cell: (r) => <span className="font-mono text-xs break-all">{r.newImage || "-"}</span> },
              { header: "Old image", cell: (r) => <span className="font-mono text-xs break-all">{r.oldImage || "-"}</span> },
            ]}
            empty={<EmptyState title="No records" description="Write items to the table to see stream records." />}
          />
        </Container>
      )}
    </>
  );
}

export default async function TablePage({ params, searchParams }: PageProps<"/dynamodb/tables/[table]">) {
  const table = decodeURIComponent((await params).table);
  const sp = (await searchParams) as Sp;
  const tabs = ["overview", "indexes", "items", "partiql", "backups", "streams", "settings"];
  const tab = tabs.includes(String(sp.tab)) ? String(sp.tab) : "overview";
  let desc: TableDescription | undefined;
  try {
    const { dynamodb } = await aws();
    desc = (await dynamodb.send(new DescribeTableCommand({ TableName: table }))).Table;
  } catch (e) {
    return (<Page><Header variant="h1">{table}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const d = desc!;
  return (
    <Page wide>
      <Header variant="h1" actions={<LinkButton href={`/dynamodb/tables/${encodeURIComponent(table)}?tab=items`} variant="primary">Explore table items</LinkButton>}>{table}</Header>
      <Tabs
        base={`/dynamodb/tables/${encodeURIComponent(table)}`}
        active={tab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "indexes", label: "Indexes" },
          { id: "items", label: "Explore items" },
          { id: "partiql", label: "PartiQL editor" },
          { id: "backups", label: "Backups" },
          { id: "streams", label: "Exports and streams" },
          { id: "settings", label: "Additional settings" },
        ]}
      />
      <Suspense key={JSON.stringify(sp)} fallback={<Container>Loading…</Container>}>
        {tab === "overview" && (
          <Container header={<Header>General information</Header>}>
            <KeyValue items={[
              { label: "Partition key", value: keyOf(d, "HASH") },
              { label: "Sort key", value: keyOf(d, "RANGE") },
              { label: "Capacity mode", value: d.BillingModeSummary?.BillingMode === "PAY_PER_REQUEST" ? "On-demand" : "Provisioned" },
              { label: "Table status", value: tableStatus(d.TableStatus) },
              { label: "Item count", value: d.ItemCount ?? 0 },
              { label: "Table size", value: formatBytes(d.TableSizeBytes) },
              { label: "Creation date", value: formatDate(d.CreationDateTime) },
              { label: "Deletion protection", value: d.DeletionProtectionEnabled ? "On" : "Off" },
              { label: "Indexes", value: (d.GlobalSecondaryIndexes?.length ?? 0) + (d.LocalSecondaryIndexes?.length ?? 0) },
              { label: "Stream", value: d.StreamSpecification?.StreamEnabled ? d.StreamSpecification.StreamViewType : "Off" },
              { label: "Amazon Resource Name (ARN)", value: <span className="font-mono text-[13px] break-all">{d.TableArn}</span> },
            ]} />
          </Container>
        )}
        {tab === "indexes" && <Indexes table={table} desc={d} />}
        {tab === "items" && <Items table={table} desc={d} sp={sp} />}
        {tab === "partiql" && <Container header={<Header description="Run PartiQL statements (ExecuteStatement) against this table.">PartiQL editor</Header>}><PartiqlEditor table={table} /></Container>}
        {tab === "backups" && <Backups table={table} />}
        {tab === "streams" && <Streams table={table} desc={d} />}
        {tab === "settings" && <Settings table={table} desc={d} />}
      </Suspense>
    </Page>
  );
}
