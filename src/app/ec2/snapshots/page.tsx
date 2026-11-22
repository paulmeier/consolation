import { DescribeSnapshotsCommand, type Snapshot } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { copySnapshot, deleteSnapshots } from "../actions";
import { ResourceState, nameTag } from "../util";

export const metadata = { title: "Snapshots | EC2" };

export default async function SnapshotsPage() {
  let snapshots: Snapshot[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    snapshots = (await ec2.send(new DescribeSnapshotsCommand({ OwnerIds: ["self"] }))).Snapshots ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              variant="h1"
              counter={snapshots.length}
              info
              description="Point-in-time copies of EBS volumes. Create one from the Volumes page; create a volume from a snapshot there too."
              actions={
                <>
                  <ConfirmAction formId="snap-form" action={deleteSnapshots} label="Delete snapshot" title="Delete snapshot" noun="snapshot" />
                  <ModalButton label="Copy snapshot" title="Copy snapshot">
                    <form action={copySnapshot} className="space-y-4">
                      <FormField label="Snapshot">
                        <Select name="snapshot">{snapshots.map((s) => <option key={s.SnapshotId} value={s.SnapshotId}>{s.SnapshotId} ({s.VolumeSize} GiB)</option>)}</Select>
                      </FormField>
                      <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="encrypted" className="accent-accent" /> Encrypt this snapshot</label>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!snapshots.length}>Copy snapshot</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Snapshots
            </Header>
            <TableFilter tableId="snap-table" placeholder="Search snapshots" />
          </div>
        }
      >
        <form id="snap-form" />
        <Table
          id="snap-table"
          formId="snap-form"
          selection="multi"
          rows={snapshots}
          rowKey={(s) => s.SnapshotId!}
          filterText={(s) => `${nameTag(s.Tags) ?? ""} ${s.SnapshotId} ${s.VolumeId} ${s.Description}`}
          columns={[
            { header: "Name", cell: (s) => nameTag(s.Tags) ?? "–" },
            { header: "Snapshot ID", cell: (s) => <span className="font-mono text-[13px]">{s.SnapshotId}</span> },
            { header: "Volume size", cell: (s) => `${s.VolumeSize} GiB` },
            { header: "Description", cell: (s) => s.Description || "–" },
            { header: "Snapshot status", cell: (s) => <ResourceState state={s.State} /> },
            { header: "Started", cell: (s) => formatDate(s.StartTime) },
            { header: "Progress", cell: (s) => s.Progress ?? "–" },
            { header: "Volume ID", cell: (s) => s.VolumeId ?? "–" },
            { header: "Encryption", cell: (s) => (s.Encrypted ? "Encrypted" : "Not encrypted") },
          ]}
          empty={<EmptyState title="No snapshots" />}
        />
      </Container>
    </Page>
  );
}
