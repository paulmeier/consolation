import { DescribeDBClusterSnapshotsCommand, DescribeDBSnapshotsCommand } from "@aws-sdk/client-rds";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { deleteSnapshots } from "../actions";
import { dbStatus } from "../shared";

export const metadata = { title: "Snapshots | RDS" };

export default async function SnapshotsPage() {
  let rows: { kind: string; id: string; source: string; status?: string; engine?: string; created?: Date; type?: string }[] = [];
  let error: string | null = null;
  try {
    const { rds } = await aws();
    const [inst, clu] = await Promise.all([rds.send(new DescribeDBSnapshotsCommand({})), rds.send(new DescribeDBClusterSnapshotsCommand({}))]);
    rows = [
      ...(inst.DBSnapshots ?? []).map((s) => ({ kind: "instance", id: s.DBSnapshotIdentifier!, source: s.DBInstanceIdentifier!, status: s.Status, engine: s.Engine, created: s.SnapshotCreateTime, type: s.SnapshotType })),
      ...(clu.DBClusterSnapshots ?? []).map((s) => ({ kind: "cluster", id: s.DBClusterSnapshotIdentifier!, source: s.DBClusterIdentifier!, status: s.Status, engine: s.Engine, created: s.SnapshotCreateTime, type: s.SnapshotType })),
    ];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header counter={rows.length} info actions={<><LinkButton href="/rds/snapshots" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton><ConfirmAction formId="snap-form" action={deleteSnapshots} label="Delete snapshot" title="Delete snapshots" noun="snapshot" confirmWord="delete me" /></>}>
              Snapshots
            </Header>
            <TableFilter tableId="snap-table" placeholder="Filter snapshots" />
          </div>
        }
      >
        <form id="snap-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="snap-table"
          formId="snap-form"
          selection="multi"
          rows={rows}
          rowKey={(r) => `${r.kind}|${r.id}`}
          filterText={(r) => `${r.id} ${r.source} ${r.engine}`}
          columns={[
            { header: "Snapshot name", cell: (r) => r.id },
            { header: "DB instance or cluster", cell: (r) => r.source },
            { header: "Status", cell: (r) => dbStatus(r.status) },
            { header: "Engine", cell: (r) => r.engine ?? "-" },
            { header: "Type", cell: (r) => r.type ?? "-" },
            { header: "Snapshot creation time", cell: (r) => formatDate(r.created) },
          ]}
          empty={<EmptyState title="No snapshots" />}
        />
      </Container>
    </Page>
  );
}
