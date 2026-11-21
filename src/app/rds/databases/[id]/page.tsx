import Link from "next/link";
import { DescribeDBClusterSnapshotsCommand, DescribeDBClustersCommand, DescribeDBInstancesCommand, DescribeDBSnapshotsCommand, type DBCluster, type DBInstance } from "@aws-sdk/client-rds";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createSnapshot, dbAction } from "../../actions";
import { dbStatus } from "../../shared";

function secretLink(arn?: string) {
  if (!arn) return "-";
  const name = arn.split(":secret:")[1]?.replace(/-[A-Za-z0-9]{6}$/, "");
  return name ? <Link className="underline-link font-mono text-xs break-all" href={`/secretsmanager/secrets/${encodeURIComponent(name)}`}>{name}</Link> : arn;
}

export default async function DatabasePage({ params, searchParams }: PageProps<"/rds/databases/[id]">) {
  const id = decodeURIComponent((await params).id);
  const kind = (await searchParams).kind === "cluster" ? "cluster" : "instance";
  const { rds } = await aws();
  let cluster: DBCluster | undefined;
  let instance: DBInstance | undefined;
  let snapshots: { id: string; status?: string; created?: Date; type?: string }[] = [];
  try {
    if (kind === "cluster") {
      cluster = (await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: id }))).DBClusters![0];
      snapshots = ((await rds.send(new DescribeDBClusterSnapshotsCommand({ DBClusterIdentifier: id }))).DBClusterSnapshots ?? []).map((s) => ({ id: s.DBClusterSnapshotIdentifier!, status: s.Status, created: s.SnapshotCreateTime, type: s.SnapshotType }));
    } else {
      instance = (await rds.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: id }))).DBInstances![0];
      snapshots = ((await rds.send(new DescribeDBSnapshotsCommand({ DBInstanceIdentifier: id }))).DBSnapshots ?? []).map((s) => ({ id: s.DBSnapshotIdentifier!, status: s.Status, created: s.SnapshotCreateTime, type: s.SnapshotType }));
    }
  } catch (e) {
    return (<Page><Header variant="h1">{id}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const c = cluster;
  const i = instance;
  const status = c ? c.Status : i?.DBInstanceStatus;
  const members = (c?.DBClusterMembers ?? []).map((m) => ({ id: m.DBInstanceIdentifier!, writer: m.IsClusterWriter }));
  const items: { label: string; value: React.ReactNode }[] = c
    ? [
        { label: "Status", value: dbStatus(c.Status) },
        { label: "Engine", value: `${c.Engine} ${c.EngineVersion ?? ""}` },
        { label: "Writer endpoint", value: <span className="font-mono text-xs break-all">{c.Endpoint}:{c.Port}</span> },
        { label: "Reader endpoint", value: <span className="font-mono text-xs break-all">{c.ReaderEndpoint ?? "-"}</span> },
        { label: "Master username", value: c.MasterUsername },
        { label: "Master credentials secret", value: secretLink(c.MasterUserSecret?.SecretArn) },
        { label: "Database name", value: c.DatabaseName ?? "-" },
        { label: "RDS Data API", value: c.HttpEndpointEnabled ? "Enabled" : "Disabled" },
        { label: "Deletion protection", value: c.DeletionProtection ? "Enabled" : "Disabled" },
        { label: "ARN", value: <span className="font-mono text-xs break-all">{c.DBClusterArn}</span> },
        { label: "Created", value: formatDate(c.ClusterCreateTime) },
      ]
    : i
      ? [
          { label: "Status", value: dbStatus(i.DBInstanceStatus) },
          { label: "Engine", value: `${i.Engine} ${i.EngineVersion ?? ""}` },
          { label: "Endpoint", value: <span className="font-mono text-xs break-all">{i.Endpoint?.Address}:{i.Endpoint?.Port}</span> },
          { label: "Class", value: i.DBInstanceClass },
          { label: "Storage", value: i.AllocatedStorage ? `${i.AllocatedStorage} GiB ${i.StorageType ?? ""}` : "-" },
          { label: "Availability Zone", value: i.AvailabilityZone ?? "-" },
          { label: "Multi-AZ", value: i.MultiAZ ? "Yes" : "No" },
          { label: "Master username", value: i.MasterUsername },
          { label: "Master credentials secret", value: secretLink(i.MasterUserSecret?.SecretArn) },
          { label: "Cluster", value: i.DBClusterIdentifier ? <Link className="underline-link" href={`/rds/databases/${encodeURIComponent(i.DBClusterIdentifier)}?kind=cluster`}>{i.DBClusterIdentifier}</Link> : "-" },
          { label: "ARN", value: <span className="font-mono text-xs break-all">{i.DBInstanceArn}</span> },
          { label: "Created", value: formatDate(i.InstanceCreateTime) },
        ]
      : [];
  const value = `${kind}|${id}`;
  const op = (o: string, label: string) => <ConfirmAction values={[value]} action={dbAction} extra={{ op: o }} label={label} title={`${label} ${id}`} noun="database" confirmWord={o} confirmLabel={label} />;
  return (
    <Page wide>
      <Header
        variant="h1"
        actions={
          <>
            <LinkButton href={`/rds/databases/${encodeURIComponent(id)}?kind=${kind}`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
            {status === "stopped" ? op("start", "Start") : op("stop", "Stop")}
            {kind === "instance" && op("reboot", "Reboot")}
            <ConfirmAction values={[value]} action={dbAction} extra={{ op: "delete", from: "detail" }} label="Delete" title={`Delete ${id}`} noun="database" confirmWord="delete me" description="No final snapshot is taken." />
            <ModalButton label="Take snapshot" title="Take snapshot" variant="primary">
              <form action={createSnapshot} className="space-y-4">
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="id" value={id} />
                <FormField label="Snapshot name"><Input name="snapshot" required pattern="[A-Za-z][A-Za-z0-9\-]*" defaultValue={`${id}-snap-1`} autoFocus /></FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Take snapshot</button></div>
              </form>
            </ModalButton>
          </>
        }
      >
        {id}
      </Header>
      <Container header={<Header>{kind === "cluster" ? "Cluster summary" : "Connectivity & configuration"}</Header>}>
        <KeyValue columns={3} items={items} />
      </Container>
      {kind === "cluster" && (
        <Container noPadding header={<Header counter={members.length}>Instances</Header>}>
          <Table rows={members} rowKey={(m) => m.id} columns={[{ header: "Instance", cell: (m) => <Link className="underline-link" href={`/rds/databases/${encodeURIComponent(m.id)}?kind=instance`}>{m.id}</Link> }, { header: "Role", cell: (m) => (m.writer ? "Writer" : "Reader") }]} empty={<EmptyState title="No instances" />} />
        </Container>
      )}
      <Container noPadding header={<Header counter={snapshots.length}>Snapshots</Header>}>
        <Table
          rows={snapshots}
          rowKey={(s) => s.id}
          columns={[
            { header: "Snapshot name", cell: (s) => s.id },
            { header: "Status", cell: (s) => dbStatus(s.status) },
            { header: "Type", cell: (s) => s.type ?? "-" },
            { header: "Created", cell: (s) => formatDate(s.created) },
          ]}
          empty={<EmptyState title="No snapshots" />}
        />
      </Container>
    </Page>
  );
}
