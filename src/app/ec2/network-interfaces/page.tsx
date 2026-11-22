import Link from "next/link";
import { DescribeInstancesCommand, DescribeNetworkInterfacesCommand, DescribeSecurityGroupsCommand, DescribeSubnetsCommand, type NetworkInterface } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { attachNetworkInterface, createNetworkInterface, deleteNetworkInterfaces, detachNetworkInterfaces } from "../actions";
import { ResourceState, nameTag } from "../util";

export const metadata = { title: "Network interfaces | EC2" };

export default async function NetworkInterfacesPage() {
  let enis: NetworkInterface[] = [];
  let subnets: { id: string; az?: string }[] = [];
  let groups: { id: string; name: string }[] = [];
  let instances: { id: string; name: string }[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    const [n, s, g, i] = await Promise.all([
      ec2.send(new DescribeNetworkInterfacesCommand({})),
      ec2.send(new DescribeSubnetsCommand({})),
      ec2.send(new DescribeSecurityGroupsCommand({})),
      ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: "instance-state-name", Values: ["running", "stopped"] }] })),
    ]);
    enis = n.NetworkInterfaces ?? [];
    subnets = (s.Subnets ?? []).map((x) => ({ id: x.SubnetId!, az: x.AvailabilityZone }));
    groups = (g.SecurityGroups ?? []).map((x) => ({ id: x.GroupId!, name: x.GroupName! }));
    instances = (i.Reservations ?? []).flatMap((r) => r.Instances ?? []).map((x) => ({ id: x.InstanceId!, name: nameTag(x.Tags) ?? "" }));
  } catch (e) {
    error = errorMessage(e);
  }
  const available = enis.filter((e) => e.Status === "available");
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              variant="h1"
              counter={enis.length}
              info
              actions={
                <>
                  <ConfirmAction formId="eni-form" action={deleteNetworkInterfaces} label="Delete" title="Delete network interface" noun="network interface" />
                  <ConfirmAction formId="eni-detach" action={detachNetworkInterfaces} label="Detach" title="Detach network interface" noun="attachment" confirmWord="detach" confirmLabel="Detach" />
                  <ModalButton label="Attach" title="Attach network interface">
                    <form action={attachNetworkInterface} className="space-y-4">
                      <FormField label="Network interface"><Select name="eni">{available.map((e) => <option key={e.NetworkInterfaceId} value={e.NetworkInterfaceId}>{e.NetworkInterfaceId} ({e.AvailabilityZone})</option>)}</Select></FormField>
                      <FormField label="Instance"><Select name="instance">{instances.map((i) => <option key={i.id} value={i.id}>{i.name ? `${i.name} ` : ""}{i.id}</option>)}</Select></FormField>
                      <FormField label="Device index"><Input name="index" type="number" min={1} defaultValue={1} /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!available.length || !instances.length}>Attach</button></div>
                    </form>
                  </ModalButton>
                  <ModalButton label="Create network interface" title="Create network interface" variant="primary">
                    <form action={createNetworkInterface} className="space-y-4">
                      <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                      <FormField label="Subnet"><Select name="subnet">{subnets.map((s) => <option key={s.id} value={s.id}>{s.id} ({s.az})</option>)}</Select></FormField>
                      <FormField label="Security groups">
                        <div className="max-h-28 space-y-1 overflow-auto rounded border border-control-border px-3 py-2">
                          {groups.map((g) => <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="groups" value={g.id} className="accent-accent" /> {g.name}</label>)}
                        </div>
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!subnets.length}>Create network interface</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Network interfaces
            </Header>
            <TableFilter tableId="eni-table" placeholder="Search network interfaces" />
          </div>
        }
      >
        <form id="eni-form" />
        <form id="eni-detach" />
        <Table
          id="eni-table"
          formId="eni-form"
          selection="multi"
          rows={enis}
          rowKey={(e) => e.NetworkInterfaceId!}
          filterText={(e) => `${e.NetworkInterfaceId} ${e.Description} ${e.PrivateIpAddress} ${e.Attachment?.InstanceId ?? ""}`}
          columns={[
            { header: "Network interface ID", cell: (e) => <span className="font-mono text-[13px]">{e.NetworkInterfaceId}</span> },
            { header: "Subnet ID", cell: (e) => e.SubnetId },
            { header: "VPC ID", cell: (e) => e.VpcId },
            { header: "Availability Zone", cell: (e) => e.AvailabilityZone },
            { header: "Security groups", cell: (e) => e.Groups?.map((g) => g.GroupName).join(", ") || "–" },
            { header: "Description", cell: (e) => e.Description || "–" },
            { header: "Interface type", cell: (e) => e.InterfaceType },
            { header: "Status", cell: (e) => <ResourceState state={e.Status} /> },
            { header: "Primary private IPv4", cell: (e) => e.PrivateIpAddress ?? "–" },
            {
              header: "Attached to",
              cell: (e) =>
                e.Attachment?.InstanceId ? (
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="selected" value={e.Attachment.AttachmentId} form="eni-detach" data-select aria-label={`Select attachment ${e.Attachment.AttachmentId}`} className="accent-accent" />
                    <Link className="text-accent hover:underline" href={`/ec2/instances/${e.Attachment.InstanceId}`}>{e.Attachment.InstanceId}</Link>
                  </label>
                ) : (
                  "–"
                ),
            },
          ]}
          empty={<EmptyState title="No network interfaces" />}
        />
      </Container>
    </Page>
  );
}
