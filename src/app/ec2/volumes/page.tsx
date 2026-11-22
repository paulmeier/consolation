import { DescribeAvailabilityZonesCommand, DescribeInstancesCommand, DescribeSnapshotsCommand, DescribeVolumesCommand, type Volume } from "@aws-sdk/client-ec2";
import Link from "next/link";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { attachVolume, createSnapshot, createVolume, deleteVolumes, detachVolumes } from "../actions";
import { ResourceState, nameTag } from "../util";

export const metadata = { title: "Volumes | EC2" };
const TYPES = ["gp3", "gp2", "io1", "io2", "st1", "sc1", "standard"];

export default async function VolumesPage() {
  let volumes: Volume[] = [];
  let zones: string[] = [];
  let instances: { id: string; name: string; az?: string }[] = [];
  let snapshots: { id: string; size?: number }[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    const [v, z, i, s] = await Promise.all([
      ec2.send(new DescribeVolumesCommand({})),
      ec2.send(new DescribeAvailabilityZonesCommand({})),
      ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: "instance-state-name", Values: ["running", "stopped", "pending"] }] })),
      ec2.send(new DescribeSnapshotsCommand({ OwnerIds: ["self"] })),
    ]);
    volumes = v.Volumes ?? [];
    zones = (z.AvailabilityZones ?? []).map((x) => x.ZoneName!);
    instances = (i.Reservations ?? []).flatMap((r) => r.Instances ?? []).map((x) => ({ id: x.InstanceId!, name: nameTag(x.Tags) ?? "", az: x.Placement?.AvailabilityZone }));
    snapshots = (s.Snapshots ?? []).map((x) => ({ id: x.SnapshotId!, size: x.VolumeSize }));
  } catch (e) {
    error = errorMessage(e);
  }
  const available = volumes.filter((v) => v.State === "available");
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              variant="h1"
              counter={volumes.length}
              info
              description="Elastic Block Store volumes. Attach a volume to an instance in the same Availability Zone."
              actions={
                <>
                  <ConfirmAction formId="vol-form" action={deleteVolumes} label="Delete volume" title="Delete volume" noun="volume" />
                  <ConfirmAction formId="vol-form" action={detachVolumes} label="Detach volume" title="Detach volume" noun="volume" confirmWord="detach" confirmLabel="Detach" fields={<label className="flex items-center gap-2 text-sm"><input type="checkbox" name="force" className="accent-accent" /> Force detach</label>} />
                  <ModalButton label="Attach volume" title="Attach volume">
                    <form action={attachVolume} className="space-y-4">
                      <FormField label="Volume">
                        <Select name="volume">{available.map((v) => <option key={v.VolumeId} value={v.VolumeId}>{v.VolumeId} ({v.AvailabilityZone}, {v.Size} GiB)</option>)}</Select>
                      </FormField>
                      <FormField label="Instance" description="Must be in the volume's Availability Zone.">
                        <Select name="instance">{instances.map((i) => <option key={i.id} value={i.id}>{i.name ? `${i.name} ` : ""}{i.id} ({i.az})</option>)}</Select>
                      </FormField>
                      <FormField label="Device name"><Input name="device" defaultValue="/dev/sdf" /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!available.length || !instances.length}>Attach volume</button></div>
                    </form>
                  </ModalButton>
                  <ModalButton label="Create snapshot" title="Create snapshot">
                    <form action={createSnapshot} className="space-y-4">
                      <FormField label="Volume">
                        <Select name="volume">{volumes.map((v) => <option key={v.VolumeId} value={v.VolumeId}>{nameTag(v.Tags) ? `${nameTag(v.Tags)} ` : ""}{v.VolumeId}</option>)}</Select>
                      </FormField>
                      <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!volumes.length}>Create snapshot</button></div>
                    </form>
                  </ModalButton>
                  <ModalButton label="Create volume" title="Create volume" variant="primary">
                    <form action={createVolume} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField label="Volume type"><Select name="type" defaultValue="gp3">{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></FormField>
                        <FormField label="Size (GiB)"><Input name="size" type="number" min={1} max={16384} defaultValue={8} /></FormField>
                        <FormField label={<>IOPS <i className="font-normal text-muted">- gp3, io1, io2</i></>}><Input name="iops" type="number" min={100} /></FormField>
                        <FormField label="Availability Zone"><Select name="az">{zones.map((z) => <option key={z}>{z}</option>)}</Select></FormField>
                        <FormField label="Snapshot ID">
                          <Select name="snapshot" defaultValue=""><option value="">Don&apos;t create from a snapshot</option>{snapshots.map((s) => <option key={s.id} value={s.id}>{s.id} ({s.size} GiB)</option>)}</Select>
                        </FormField>
                        <FormField label={<>Name <i className="font-normal text-muted">- optional</i></>}><Input name="name" /></FormField>
                      </div>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="encrypted" className="accent-accent" /> Encrypt this volume</label>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create volume</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Volumes
            </Header>
            <TableFilter tableId="vol-table" placeholder="Search volumes" />
          </div>
        }
      >
        <form id="vol-form" />
        <Table
          id="vol-table"
          formId="vol-form"
          selection="multi"
          rows={volumes}
          rowKey={(v) => v.VolumeId!}
          filterText={(v) => `${nameTag(v.Tags) ?? ""} ${v.VolumeId} ${v.VolumeType} ${v.State}`}
          columns={[
            { header: "Name", cell: (v) => nameTag(v.Tags) ?? "–" },
            { header: "Volume ID", cell: (v) => <span className="font-mono text-[13px]">{v.VolumeId}</span> },
            { header: "Type", cell: (v) => v.VolumeType },
            { header: "Size", cell: (v) => `${v.Size} GiB`, sortValue: (v) => v.Size },
            { header: "IOPS", cell: (v) => v.Iops ?? "–" },
            { header: "Snapshot", cell: (v) => v.SnapshotId || "–" },
            { header: "Created", cell: (v) => formatDate(v.CreateTime) },
            { header: "Availability Zone", cell: (v) => v.AvailabilityZone },
            { header: "Volume state", cell: (v) => <ResourceState state={v.State} /> },
            { header: "Attached resources", cell: (v) => v.Attachments?.map((a) => <Link key={a.InstanceId} className="text-accent hover:underline" href={`/ec2/instances/${a.InstanceId}`}>{a.InstanceId} ({a.Device})</Link>) ?? "–" },
            { header: "Encrypted", cell: (v) => (v.Encrypted ? "Encrypted" : "Not encrypted") },
          ]}
          empty={<EmptyState title="No volumes" description="Create a volume to get started." />}
        />
      </Container>
    </Page>
  );
}
