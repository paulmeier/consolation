import Link from "next/link";
import { DescribeAddressesCommand, DescribeInstancesCommand, type Address } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { allocateAddress, associateAddress, disassociateAddresses, releaseAddresses } from "../actions";
import { nameTag } from "../util";

export const metadata = { title: "Elastic IP addresses | EC2" };

export default async function ElasticIpsPage() {
  let addresses: Address[] = [];
  let instances: { id: string; name: string }[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    const [a, i] = await Promise.all([
      ec2.send(new DescribeAddressesCommand({})),
      ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: "instance-state-name", Values: ["running", "stopped"] }] })),
    ]);
    addresses = a.Addresses ?? [];
    instances = (i.Reservations ?? []).flatMap((r) => r.Instances ?? []).map((x) => ({ id: x.InstanceId!, name: nameTag(x.Tags) ?? "" }));
  } catch (e) {
    error = errorMessage(e);
  }
  const free = addresses.filter((a) => !a.AssociationId);
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            variant="h1"
            counter={addresses.length}
            info
            description="Static public IPv4 addresses you can move between instances."
            actions={
              <>
                <ConfirmAction formId="eip-release" action={releaseAddresses} label="Release" title="Release Elastic IP addresses" noun="address" confirmWord="release" confirmLabel="Release" />
                <ConfirmAction formId="eip-disassociate" action={disassociateAddresses} label="Disassociate" title="Disassociate Elastic IP addresses" noun="association" confirmWord="disassociate" confirmLabel="Disassociate" />
                <ModalButton label="Associate Elastic IP address" title="Associate Elastic IP address">
                  <form action={associateAddress} className="space-y-4">
                    <FormField label="Elastic IP address">
                      <Select name="allocation">{addresses.map((a) => <option key={a.AllocationId} value={a.AllocationId}>{a.PublicIp}{a.AssociationId ? " (associated)" : ""}</option>)}</Select>
                    </FormField>
                    <FormField label="Instance" description="Or enter a network interface ID (eni-…) below.">
                      <Select name="target">{instances.map((i) => <option key={i.id} value={i.id}>{i.name ? `${i.name} ` : ""}{i.id}</option>)}</Select>
                    </FormField>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reassociate" className="accent-accent" /> Allow this Elastic IP address to be reassociated</label>
                    <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!addresses.length || !instances.length}>Associate</button></div>
                  </form>
                </ModalButton>
                <ModalButton label="Allocate Elastic IP address" title="Allocate Elastic IP address" variant="primary">
                  <form action={allocateAddress} className="space-y-4">
                    <FormField label={<>Name tag <i className="font-normal text-muted">- optional</i></>}><Input name="name" /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Allocate</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Elastic IP addresses
          </Header>
        }
      >
        {/* Two forms: rows submit their allocation ID to release and their association ID to disassociate. */}
        <form id="eip-release" />
        <form id="eip-disassociate" />
        <Table
          formId="eip-release"
          selection="multi"
          rows={addresses}
          rowKey={(a) => a.AllocationId!}
          columns={[
            { header: "Name", cell: (a) => nameTag(a.Tags) ?? "–" },
            { header: "Allocated IPv4 address", cell: (a) => <span className="font-mono text-[13px]">{a.PublicIp}</span> },
            { header: "Allocation ID", cell: (a) => <span className="font-mono text-[13px]">{a.AllocationId}</span> },
            { header: "Associated instance", cell: (a) => (a.InstanceId ? <Link className="text-accent hover:underline" href={`/ec2/instances/${a.InstanceId}`}>{a.InstanceId}</Link> : "–") },
            { header: "Private IP", cell: (a) => a.PrivateIpAddress ?? "–" },
            {
              header: "Association ID",
              cell: (a) =>
                a.AssociationId ? (
                  <label className="flex items-center gap-1.5 font-mono text-[13px]">
                    <input type="checkbox" name="selected" value={a.AssociationId} form="eip-disassociate" data-select aria-label={`Select association ${a.AssociationId}`} className="accent-accent" />
                    {a.AssociationId}
                  </label>
                ) : (
                  "–"
                ),
            },
          ]}
          empty={<EmptyState title="No Elastic IP addresses" description={free.length ? "" : "Allocate an address to get started."} />}
        />
      </Container>
    </Page>
  );
}
