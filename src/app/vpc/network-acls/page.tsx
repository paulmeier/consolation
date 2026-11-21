import { DescribeNetworkAclsCommand, type NetworkAcl } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Container, EmptyState, ErrorAlert, Header } from "@/components/ui";
import { nameTag } from "../shared";

export const metadata = { title: "Network ACLs | VPC" };

const proto = (p?: string) => (p === "-1" ? "All" : p === "6" ? "TCP" : p === "17" ? "UDP" : p === "1" ? "ICMP" : p);

export default async function NaclPage() {
  let acls: NetworkAcl[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    acls = (await ec2.send(new DescribeNetworkAclsCommand({}))).NetworkAcls ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      {acls.length === 0 && !error && <EmptyState title="No network ACLs" />}
      {acls.map((a) => (
        <Container key={a.NetworkAclId} noPadding header={<Header description={`${a.VpcId} · ${a.IsDefault ? "Default" : "Custom"} · ${(a.Associations ?? []).length} subnet associations`}>{a.NetworkAclId} / {nameTag(a.Tags)}</Header>}>
          <Table
            rows={a.Entries ?? []}
            rowKey={(e) => `${e.Egress}-${e.RuleNumber}`}
            columns={[
              { header: "Direction", cell: (e) => (e.Egress ? "Outbound" : "Inbound") },
              { header: "Rule number", cell: (e) => (e.RuleNumber === 32767 ? "*" : e.RuleNumber), sortValue: (e) => e.RuleNumber ?? 0 },
              { header: "Protocol", cell: (e) => proto(e.Protocol) },
              { header: "Port range", cell: (e) => (e.PortRange ? `${e.PortRange.From}-${e.PortRange.To}` : "All") },
              { header: "Source/destination", cell: (e) => e.CidrBlock ?? e.Ipv6CidrBlock },
              { header: "Allow/Deny", cell: (e) => <span className={e.RuleAction === "allow" ? "text-success" : "text-danger"}>{e.RuleAction === "allow" ? "Allow" : "Deny"}</span> },
            ]}
          />
        </Container>
      ))}
    </Page>
  );
}
