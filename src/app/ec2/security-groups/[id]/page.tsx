import { DescribeSecurityGroupRulesCommand, DescribeSecurityGroupsCommand, type SecurityGroupRule } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Table } from "@/components/table";
import { ModalButton } from "@/components/client/modal";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, buttonClass } from "@/components/ui";
import { addSecurityGroupRule, removeSecurityGroupRules } from "../../actions";
import { Ec2Tags } from "../../util";

const PROTOCOLS: [string, string][] = [
  ["tcp", "TCP"],
  ["udp", "UDP"],
  ["icmp", "ICMP"],
  ["-1", "All traffic"],
];

function port(r: SecurityGroupRule) {
  if (r.IpProtocol === "-1") return "All";
  if (r.FromPort === r.ToPort) return String(r.FromPort);
  return `${r.FromPort} - ${r.ToPort}`;
}
const source = (r: SecurityGroupRule) => r.CidrIpv4 ?? r.CidrIpv6 ?? r.ReferencedGroupInfo?.GroupId ?? r.PrefixListId ?? "-";

function Rules({ group, dir, rules }: { group: string; dir: "ingress" | "egress"; rules: SecurityGroupRule[] }) {
  const form = `${dir}-rules`;
  const label = dir === "ingress" ? "Inbound" : "Outbound";
  return (
    <Container
      noPadding
      header={
        <Header
          counter={rules.length}
          actions={
            <>
              <ConfirmAction formId={form} action={removeSecurityGroupRules} extra={{ group, direction: dir }} label="Delete rules" title={`Delete ${label.toLowerCase()} rules`} noun="rule" />
              <ModalButton label={`Add ${label.toLowerCase()} rule`} title={`Add ${label.toLowerCase()} rule`} variant="primary">
                <form action={addSecurityGroupRule} className="space-y-4">
                  <input type="hidden" name="group" value={group} />
                  <input type="hidden" name="direction" value={dir} />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField label="Protocol">
                      <Select name="protocol" defaultValue="tcp">{PROTOCOLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                    </FormField>
                    <FormField label="From port" constraint="For ICMP, the type (-1 for all).">
                      <Input name="from" type="number" min={-1} max={65535} defaultValue={22} />
                    </FormField>
                    <FormField label="To port" constraint="Empty means the same as From.">
                      <Input name="to" type="number" min={-1} max={65535} />
                    </FormField>
                  </div>
                  <FormField label={dir === "ingress" ? "Source" : "Destination"} description="An IPv4 or IPv6 CIDR, a security group ID (sg-…) or a prefix list ID (pl-…).">
                    <Input name="source" required defaultValue={dir === "ingress" ? "0.0.0.0/0" : "0.0.0.0/0"} />
                  </FormField>
                  <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" maxLength={255} /></FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save rule</button></div>
                </form>
              </ModalButton>
            </>
          }
        >
          {label} rules
        </Header>
      }
    >
      <form id={form} />
      <Table
        formId={form}
        selection="multi"
        rows={rules}
        rowKey={(r) => r.SecurityGroupRuleId!}
        columns={[
          { header: "Security group rule ID", cell: (r) => <span className="font-mono text-[13px]">{r.SecurityGroupRuleId}</span> },
          { header: "IP version", cell: (r) => (r.CidrIpv6 ? "IPv6" : r.CidrIpv4 ? "IPv4" : "–") },
          { header: "Protocol", cell: (r) => (r.IpProtocol === "-1" ? "All" : r.IpProtocol?.toUpperCase()) },
          { header: "Port range", cell: port },
          { header: dir === "ingress" ? "Source" : "Destination", cell: (r) => <span className="font-mono text-[13px]">{source(r)}</span> },
          { header: "Description", cell: (r) => r.Description || "–" },
        ]}
        empty={<EmptyState title={`No ${label.toLowerCase()} rules`} />}
      />
    </Container>
  );
}

export default async function SecurityGroupPage({ params, searchParams }: PageProps<"/ec2/security-groups/[id]">) {
  const id = (await params).id;
  const t = String((await searchParams).tab ?? "inbound");
  const tab = ["inbound", "outbound", "tags"].includes(t) ? t : "inbound";
  let sg, rules: SecurityGroupRule[] = [];
  try {
    const { ec2 } = await aws();
    sg = (await ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: [id] }))).SecurityGroups?.[0];
    rules = (await ec2.send(new DescribeSecurityGroupRulesCommand({ Filters: [{ Name: "group-id", Values: [id] }] }))).SecurityGroupRules ?? [];
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{id}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const base = `/ec2/security-groups/${id}`;
  const inbound = rules.filter((r) => !r.IsEgress);
  const outbound = rules.filter((r) => r.IsEgress);
  return (
    <Page wide>
      <Header variant="h1">{`${id} - ${sg?.GroupName ?? ""}`}</Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          columns={4}
          items={[
            { label: "Security group name", value: sg?.GroupName },
            { label: "Security group ID", value: <span className="font-mono text-[13px]">{id}</span> },
            { label: "Description", value: sg?.Description },
            { label: "VPC ID", value: sg?.VpcId ?? "–" },
            { label: "Owner", value: sg?.OwnerId },
            { label: "Inbound rules count", value: `${inbound.length} Permission entries` },
            { label: "Outbound rules count", value: `${outbound.length} Permission entries` },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "inbound", label: "Inbound rules" }, { id: "outbound", label: "Outbound rules" }, { id: "tags", label: "Tags" }]} />
      {tab === "inbound" && <Rules group={id} dir="ingress" rules={inbound} />}
      {tab === "outbound" && <Rules group={id} dir="egress" rules={outbound} />}
      {tab === "tags" && <Ec2Tags id={id} tags={sg?.Tags} path={`${base}?tab=tags`} />}
    </Page>
  );
}
