import { DescribeInternetGatewaysCommand, DescribeNatGatewaysCommand, DescribeRouteTablesCommand, DescribeSubnetsCommand } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, buttonClass } from "@/components/ui";
import { addRoute, associateSubnet, deleteRoutes, disassociate } from "../../actions";
import { ec2State, nameTag } from "../../shared";

export default async function RouteTablePage({ params }: PageProps<"/vpc/route-tables/[id]">) {
  const id = (await params).id;
  const { ec2 } = await aws();
  let data;
  try {
    const rt = (await ec2.send(new DescribeRouteTablesCommand({ RouteTableIds: [id] }))).RouteTables![0];
    const f = [{ Name: "vpc-id", Values: [rt.VpcId!] }];
    data = await Promise.all([
      rt,
      ec2.send(new DescribeSubnetsCommand({ Filters: f })).then((r) => r.Subnets ?? []),
      ec2.send(new DescribeInternetGatewaysCommand({ Filters: [{ Name: "attachment.vpc-id", Values: [rt.VpcId!] }] })).then((r) => r.InternetGateways ?? []),
      ec2.send(new DescribeNatGatewaysCommand({ Filter: f })).then((r) => r.NatGateways ?? []).catch(() => []),
    ]);
  } catch (e) {
    return (<Page><Header variant="h1">{id}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const [rt, subnets, igws, nats] = data;
  const hidden = <input type="hidden" name="rt" value={id} />;
  const assocs = (rt.Associations ?? []).filter((a) => a.SubnetId);
  const targets = [...igws.map((g) => g.InternetGatewayId!), ...nats.map((n) => n.NatGatewayId!)];
  return (
    <Page wide>
      <Header variant="h1">{id} / {nameTag(rt.Tags)}</Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue items={[
          { label: "Route table ID", value: <span className="font-mono text-[13px]">{id}</span> },
          { label: "Main", value: rt.Associations?.some((a) => a.Main) ? "Yes" : "No" },
          { label: "VPC", value: <span className="font-mono text-[13px]">{rt.VpcId}</span> },
        ]} />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={rt.Routes?.length ?? 0}
            actions={
              <>
                <ConfirmAction formId="routes-form" action={deleteRoutes} extra={{ rt: id }} label="Remove" title="Remove routes" noun="route" confirmWord="remove" confirmLabel="Remove" />
                <ModalButton label="Add route" title="Add route" variant="primary">
                  <form action={addRoute} className="space-y-4">
                    {hidden}
                    <FormField label="Destination"><Input name="destination" required defaultValue="0.0.0.0/0" /></FormField>
                    <FormField label="Target" description="Internet gateway, NAT gateway or peering connection ID.">
                      {targets.length ? <Select name="target">{targets.map((t) => <option key={t}>{t}</option>)}</Select> : <Input name="target" required placeholder="igw-…" />}
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Routes
          </Header>
        }
      >
        <form id="routes-form" />
        <Table
          formId="routes-form"
          selection="multi"
          rows={rt.Routes ?? []}
          rowKey={(r) => r.DestinationCidrBlock ?? r.DestinationPrefixListId ?? r.DestinationIpv6CidrBlock ?? ""}
          columns={[
            { header: "Destination", cell: (r) => r.DestinationCidrBlock ?? r.DestinationIpv6CidrBlock ?? r.DestinationPrefixListId },
            { header: "Target", cell: (r) => r.GatewayId ?? r.NatGatewayId ?? r.VpcPeeringConnectionId ?? r.NetworkInterfaceId ?? r.TransitGatewayId ?? "-" },
            { header: "Status", cell: (r) => ec2State(r.State) },
            { header: "Origin", cell: (r) => r.Origin },
          ]}
          empty={<EmptyState title="No routes" />}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={assocs.length}
            actions={
              <>
                <ConfirmAction formId="assoc-form" action={disassociate} extra={{ rt: id }} label="Disassociate" title="Disassociate subnets" noun="association" confirmWord="disassociate" confirmLabel="Disassociate" />
                <ModalButton label="Edit subnet associations" title="Associate subnet">
                  <form action={associateSubnet} className="space-y-4">
                    {hidden}
                    <FormField label="Subnet"><Select name="subnet">{subnets.map((s) => <option key={s.SubnetId} value={s.SubnetId}>{s.SubnetId} ({s.CidrBlock})</option>)}</Select></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save associations</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Explicit subnet associations
          </Header>
        }
      >
        <form id="assoc-form" />
        <Table
          formId="assoc-form"
          selection="multi"
          rows={assocs}
          rowKey={(a) => a.RouteTableAssociationId!}
          columns={[
            { header: "Subnet ID", cell: (a) => <span className="font-mono text-[13px]">{a.SubnetId}</span> },
            { header: "IPv4 CIDR", cell: (a) => subnets.find((s) => s.SubnetId === a.SubnetId)?.CidrBlock ?? "-" },
            { header: "Association ID", cell: (a) => <span className="font-mono text-xs">{a.RouteTableAssociationId}</span> },
          ]}
          empty={<EmptyState title="No explicit associations" description="Subnets without an explicit association use the main route table." />}
        />
      </Container>
    </Page>
  );
}
