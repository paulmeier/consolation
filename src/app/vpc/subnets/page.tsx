import { DescribeSubnetsCommand, DescribeVpcsCommand, type Subnet } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createSubnet, deleteSubnets } from "../actions";
import { ec2State, nameTag } from "../shared";

export const metadata = { title: "Subnets | VPC" };

export default async function SubnetsPage() {
  let subnets: Subnet[] = [];
  let vpcs: string[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    [subnets, vpcs] = await Promise.all([
      ec2.send(new DescribeSubnetsCommand({})).then((r) => r.Subnets ?? []),
      ec2.send(new DescribeVpcsCommand({})).then((r) => (r.Vpcs ?? []).map((v) => v.VpcId!)),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={subnets.length}
              info
              actions={
                <>
                  <LinkButton href="/vpc/subnets" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="subnets-form" action={deleteSubnets} label="Delete subnet" title="Delete subnet" noun="subnet" confirmWord="delete" />
                  <ModalButton label="Create subnet" title="Create subnet" variant="primary">
                    <form action={createSubnet} className="space-y-4">
                      <FormField label="VPC ID"><Select name="vpc">{vpcs.map((v) => <option key={v}>{v}</option>)}</Select></FormField>
                      <FormField label={<>Subnet name <i className="font-normal text-muted">- optional</i></>}><Input name="name" /></FormField>
                      <FormField label="IPv4 subnet CIDR block"><Input name="cidr" required placeholder="10.0.1.0/24" /></FormField>
                      <FormField label={<>Availability Zone <i className="font-normal text-muted">- optional</i></>}><Input name="az" placeholder="us-east-1a" /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create subnet</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Subnets
            </Header>
            <TableFilter tableId="subnets-table" placeholder="Filter subnets" />
          </div>
        }
      >
        <form id="subnets-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="subnets-table"
          formId="subnets-form"
          selection="multi"
          rows={subnets}
          rowKey={(s) => s.SubnetId!}
          filterText={(s) => `${nameTag(s.Tags)} ${s.SubnetId} ${s.VpcId} ${s.CidrBlock} ${s.AvailabilityZone}`}
          columns={[
            { header: "Name", cell: (s) => nameTag(s.Tags) },
            { header: "Subnet ID", cell: (s) => <span className="font-mono text-[13px]">{s.SubnetId}</span> },
            { header: "State", cell: (s) => ec2State(s.State) },
            { header: "VPC", cell: (s) => <span className="font-mono text-[13px]">{s.VpcId}</span> },
            { header: "IPv4 CIDR", cell: (s) => s.CidrBlock },
            { header: "Available IPv4 addresses", cell: (s) => s.AvailableIpAddressCount, sortValue: (s) => s.AvailableIpAddressCount ?? 0 },
            { header: "Availability Zone", cell: (s) => s.AvailabilityZone },
            { header: "Default subnet", cell: (s) => (s.DefaultForAz ? "Yes" : "No") },
            { header: "Auto-assign public IPv4", cell: (s) => (s.MapPublicIpOnLaunch ? "Yes" : "No") },
          ]}
          empty={<EmptyState title="No subnets found" />}
        />
      </Container>
    </Page>
  );
}
