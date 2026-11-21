import Link from "next/link";
import { DescribeDBClustersCommand, DescribeDBInstancesCommand, type DBCluster, type DBInstance } from "@aws-sdk/client-rds";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { dbAction } from "../actions";
import { dbStatus } from "../shared";

export const metadata = { title: "Databases | RDS" };

type Row = { kind: "cluster" | "instance"; id: string; role: string; engine: string; status?: string; size: string; az?: string; parent?: string };

export default async function DatabasesPage() {
  let rows: Row[] = [];
  let error: string | null = null;
  try {
    const { rds } = await aws();
    const [clusters, instances] = await Promise.all([
      rds.send(new DescribeDBClustersCommand({})).then((r) => r.DBClusters ?? ([] as DBCluster[])),
      rds.send(new DescribeDBInstancesCommand({})).then((r) => r.DBInstances ?? ([] as DBInstance[])),
    ]);
    for (const c of clusters) {
      rows.push({ kind: "cluster", id: c.DBClusterIdentifier!, role: "Regional cluster", engine: `${c.Engine} ${c.EngineVersion ?? ""}`, status: c.Status, size: `${c.DBClusterMembers?.length ?? 0} instances` });
      for (const m of c.DBClusterMembers ?? []) {
        const i = instances.find((x) => x.DBInstanceIdentifier === m.DBInstanceIdentifier);
        if (i) rows.push({ kind: "instance", id: i.DBInstanceIdentifier!, role: m.IsClusterWriter ? "Writer instance" : "Reader instance", engine: `${i.Engine} ${i.EngineVersion ?? ""}`, status: i.DBInstanceStatus, size: i.DBInstanceClass ?? "-", az: i.AvailabilityZone, parent: c.DBClusterIdentifier });
      }
    }
    for (const i of instances.filter((x) => !x.DBClusterIdentifier)) rows.push({ kind: "instance", id: i.DBInstanceIdentifier!, role: "Instance", engine: `${i.Engine} ${i.EngineVersion ?? ""}`, status: i.DBInstanceStatus, size: i.DBInstanceClass ?? "-", az: i.AvailabilityZone });
  } catch (e) {
    error = errorMessage(e);
    rows = [];
  }
  const actions = (["stop", "start", "reboot"] as const).map((op) => (
    <ConfirmAction key={op} formId="db-form" action={dbAction} extra={{ op }} label={op[0].toUpperCase() + op.slice(1)} title={`${op[0].toUpperCase()}${op.slice(1)} database`} noun="database" confirmWord={op} confirmLabel={op[0].toUpperCase() + op.slice(1)} />
  ));
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={rows.length}
              info
              actions={
                <>
                  <LinkButton href="/rds/databases" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  {actions}
                  <ConfirmAction formId="db-form" action={dbAction} extra={{ op: "delete" }} label="Delete" title="Delete database" noun="database" confirmWord="delete me" description="No final snapshot is taken. Delete a cluster's instances before the cluster." />
                  <LinkButton href="/rds/databases/create" variant="primary">Create database</LinkButton>
                </>
              }
            >
              Databases
            </Header>
            <TableFilter tableId="db-table" placeholder="Filter by databases" />
          </div>
        }
      >
        <form id="db-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="db-table"
          formId="db-form"
          selection="multi"
          rows={rows}
          rowKey={(r) => `${r.kind}|${r.id}`}
          filterText={(r) => `${r.id} ${r.engine} ${r.role}`}
          columns={[
            { header: "DB identifier", cell: (r) => <Link className={`underline-link ${r.parent ? "ml-5" : ""}`} href={`/rds/databases/${encodeURIComponent(r.id)}?kind=${r.kind}`}>{r.id}</Link> },
            { header: "Status", cell: (r) => dbStatus(r.status) },
            { header: "Role", cell: (r) => r.role },
            { header: "Engine", cell: (r) => r.engine },
            { header: "Region & AZ", cell: (r) => r.az ?? "us-east-1" },
            { header: "Size", cell: (r) => r.size },
          ]}
          empty={<EmptyState title="No databases" action={<LinkButton href="/rds/databases/create">Create database</LinkButton>} />}
        />
      </Container>
    </Page>
  );
}
