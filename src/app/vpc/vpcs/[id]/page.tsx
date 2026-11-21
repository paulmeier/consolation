import Link from "next/link";
import {
  DescribeInternetGatewaysCommand,
  DescribeNatGatewaysCommand,
  DescribeRouteTablesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVpcAttributeCommand,
  DescribeVpcsCommand,
} from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, ErrorAlert, FormField, Header, Input, KeyValue, buttonClass } from "@/components/ui";
import { createSubnet, deleteVpcs } from "../../actions";
import { ec2State, nameTag } from "../../shared";

function Column({ title, items }: { title: string; items: { id: string; label: string; href?: string; sub?: string }[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-bold text-muted">{title} ({items.length})</h3>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            {i.href ? <Link href={i.href} className="underline-link font-medium">{i.label}</Link> : <span className="font-medium">{i.label}</span>}
            {i.sub && <span className="block text-xs text-muted">{i.sub}</span>}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted">None</li>}
      </ul>
    </div>
  );
}

export default async function VpcPage({ params }: PageProps<"/vpc/vpcs/[id]">) {
  const id = (await params).id;
  const { ec2 } = await aws();
  const f = [{ Name: "vpc-id", Values: [id] }];
  let data;
  try {
    data = await Promise.all([
      ec2.send(new DescribeVpcsCommand({ VpcIds: [id] })),
      ec2.send(new DescribeSubnetsCommand({ Filters: f })),
      ec2.send(new DescribeRouteTablesCommand({ Filters: f })),
      ec2.send(new DescribeInternetGatewaysCommand({ Filters: [{ Name: "attachment.vpc-id", Values: [id] }] })),
      ec2.send(new DescribeNatGatewaysCommand({ Filter: f })).catch(() => ({ NatGateways: [] })),
      ec2.send(new DescribeSecurityGroupsCommand({ Filters: f })),
      ec2.send(new DescribeVpcAttributeCommand({ VpcId: id, Attribute: "enableDnsHostnames" })).catch(() => null),
      ec2.send(new DescribeVpcAttributeCommand({ VpcId: id, Attribute: "enableDnsSupport" })).catch(() => null),
    ]);
  } catch (e) {
    return (<Page><Header variant="h1">{id}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const [vr, subnets, rts, igws, nats, sgs, dnsHost, dnsSup] = data;
  const v = vr.Vpcs![0];
  return (
    <Page wide>
      <Header
        variant="h1"
        info
        actions={
          <>
            <ConfirmAction values={[id]} extra={{ from: "detail" }} action={deleteVpcs} label="Delete VPC" title="Delete VPC" noun="VPC" confirmWord="delete" />
            <ModalButton label="Create subnet" title="Create subnet" variant="primary">
              <form action={createSubnet} className="space-y-4">
                <input type="hidden" name="vpc" value={id} />
                <FormField label={<>Subnet name <i className="font-normal text-muted">- optional</i></>}><Input name="name" autoFocus /></FormField>
                <FormField label="IPv4 subnet CIDR block" description={`Within ${v.CidrBlock}`}><Input name="cidr" required placeholder="10.0.1.0/24" /></FormField>
                <FormField label={<>Availability Zone <i className="font-normal text-muted">- optional</i></>}><Input name="az" placeholder="us-east-1a" /></FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Create subnet</button></div>
              </form>
            </ModalButton>
          </>
        }
      >
        {id} / {nameTag(v.Tags)}
      </Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          columns={4}
          items={[
            { label: "VPC ID", value: <span className="font-mono text-[13px]">{id}</span> },
            { label: "State", value: ec2State(v.State) },
            { label: "IPv4 CIDR", value: (v.CidrBlockAssociationSet ?? []).map((c) => c.CidrBlock).join(", ") || v.CidrBlock },
            { label: "Default VPC", value: v.IsDefault ? "Yes" : "No" },
            { label: "DNS hostnames", value: dnsHost?.EnableDnsHostnames?.Value ? "Enabled" : "Disabled" },
            { label: "DNS resolution", value: dnsSup?.EnableDnsSupport?.Value ? "Enabled" : "Disabled" },
            { label: "Tenancy", value: v.InstanceTenancy },
            { label: "DHCP option set", value: v.DhcpOptionsId ?? "-" },
          ]}
        />
      </Container>
      <Container header={<Header description="How the resources in this VPC connect.">Resource map</Header>}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Column title="Subnets" items={(subnets.Subnets ?? []).map((s) => ({ id: s.SubnetId!, label: `${nameTag(s.Tags) !== "–" ? nameTag(s.Tags) : s.SubnetId}`, sub: `${s.CidrBlock} · ${s.AvailabilityZone}` }))} />
          <Column title="Route tables" items={(rts.RouteTables ?? []).map((r) => ({ id: r.RouteTableId!, label: nameTag(r.Tags) !== "–" ? nameTag(r.Tags) : r.RouteTableId!, href: `/vpc/route-tables/${r.RouteTableId}`, sub: `${r.Routes?.length ?? 0} routes${r.Associations?.some((a) => a.Main) ? " · main" : ""}` }))} />
          <Column
            title="Network connections"
            items={[
              ...(igws.InternetGateways ?? []).map((g) => ({ id: g.InternetGatewayId!, label: g.InternetGatewayId!, href: "/vpc/internet-gateways", sub: "Internet gateway" })),
              ...(nats.NatGateways ?? []).map((n) => ({ id: n.NatGatewayId!, label: n.NatGatewayId!, href: "/vpc/nat-gateways", sub: `NAT gateway · ${n.State}` })),
            ]}
          />
          <Column title="Security groups" items={(sgs.SecurityGroups ?? []).map((g) => ({ id: g.GroupId!, label: g.GroupName!, href: "/ec2/security-groups", sub: g.GroupId }))} />
        </div>
      </Container>
    </Page>
  );
}
