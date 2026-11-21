import { DescribeAddressesCommand, DescribeNatGatewaysCommand, DescribeSubnetsCommand, type NatGateway } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createNat, deleteNats } from "../actions";
import { ec2State, nameTag } from "../shared";

export const metadata = { title: "NAT gateways | VPC" };

export default async function NatPage() {
  let nats: NatGateway[] = [];
  let subnets: { id: string; label: string }[] = [];
  let eips: string[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    [nats, subnets, eips] = await Promise.all([
      ec2.send(new DescribeNatGatewaysCommand({})).then((r) => r.NatGateways ?? []),
      ec2.send(new DescribeSubnetsCommand({})).then((r) => (r.Subnets ?? []).map((s) => ({ id: s.SubnetId!, label: `${s.SubnetId} (${s.CidrBlock}, ${s.VpcId})` }))),
      ec2.send(new DescribeAddressesCommand({})).then((r) => (r.Addresses ?? []).filter((a) => !a.AssociationId).map((a) => a.AllocationId!)),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <Header
            counter={nats.length}
            info
            actions={
              <>
                <LinkButton href="/vpc/nat-gateways" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId="nat-form" action={deleteNats} label="Delete NAT gateway" title="Delete NAT gateway" noun="NAT gateway" confirmWord="delete" />
                <ModalButton label="Create NAT gateway" title="Create NAT gateway" variant="primary">
                  <form action={createNat} className="space-y-4">
                    <FormField label={<>Name <i className="font-normal text-muted">- optional</i></>}><Input name="name" autoFocus /></FormField>
                    <FormField label="Subnet"><Select name="subnet">{subnets.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></FormField>
                    <FormField label="Connectivity type">
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2"><input type="radio" name="connectivity" value="public" defaultChecked className="accent-accent" /> Public</label>
                        <label className="flex items-center gap-2"><input type="radio" name="connectivity" value="private" className="accent-accent" /> Private</label>
                      </div>
                    </FormField>
                    <FormField label="Elastic IP allocation ID" description="Leave empty to allocate a new one.">
                      <Select name="eip" defaultValue=""><option value="">Allocate Elastic IP</option>{eips.map((e) => <option key={e}>{e}</option>)}</Select>
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create NAT gateway</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            NAT gateways
          </Header>
        }
      >
        <form id="nat-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          formId="nat-form"
          selection="multi"
          rows={nats}
          rowKey={(n) => n.NatGatewayId!}
          columns={[
            { header: "Name", cell: (n) => nameTag(n.Tags) },
            { header: "NAT gateway ID", cell: (n) => <span className="font-mono text-[13px]">{n.NatGatewayId}</span> },
            { header: "Connectivity type", cell: (n) => n.ConnectivityType },
            { header: "State", cell: (n) => ec2State(n.State) },
            { header: "Primary public IPv4", cell: (n) => n.NatGatewayAddresses?.[0]?.PublicIp ?? "-" },
            { header: "Primary private IPv4", cell: (n) => n.NatGatewayAddresses?.[0]?.PrivateIp ?? "-" },
            { header: "VPC", cell: (n) => n.VpcId },
            { header: "Subnet", cell: (n) => n.SubnetId },
            { header: "Created", cell: (n) => formatDate(n.CreateTime) },
          ]}
          empty={<EmptyState title="No NAT gateways" />}
        />
      </Container>
    </Page>
  );
}
