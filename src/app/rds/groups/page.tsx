import { DescribeDBParameterGroupsCommand, DescribeDBSubnetGroupsCommand, type DBParameterGroup, type DBSubnetGroup } from "@aws-sdk/client-rds";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Container, EmptyState, ErrorAlert, Header } from "@/components/ui";

export const metadata = { title: "Subnet and parameter groups | RDS" };

export default async function GroupsPage() {
  let subnets: DBSubnetGroup[] = [];
  let params: DBParameterGroup[] = [];
  let error: string | null = null;
  try {
    const { rds } = await aws();
    [subnets, params] = await Promise.all([
      rds.send(new DescribeDBSubnetGroupsCommand({})).then((r) => r.DBSubnetGroups ?? []),
      rds.send(new DescribeDBParameterGroupsCommand({})).then((r) => r.DBParameterGroups ?? []),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container noPadding header={<Header counter={subnets.length} info>Subnet groups</Header>}>
        <Table rows={subnets} rowKey={(s) => s.DBSubnetGroupName!} columns={[
          { header: "Name", cell: (s) => s.DBSubnetGroupName },
          { header: "Description", cell: (s) => s.DBSubnetGroupDescription },
          { header: "Status", cell: (s) => s.SubnetGroupStatus },
          { header: "VPC", cell: (s) => s.VpcId },
          { header: "Subnets", cell: (s) => s.Subnets?.length ?? 0 },
        ]} empty={<EmptyState title="No subnet groups" />} />
      </Container>
      <Container noPadding header={<Header counter={params.length}>Parameter groups</Header>}>
        <Table rows={params} rowKey={(p) => p.DBParameterGroupName!} columns={[
          { header: "Name", cell: (p) => p.DBParameterGroupName },
          { header: "Family", cell: (p) => p.DBParameterGroupFamily },
          { header: "Type", cell: (p) => (p.DBParameterGroupName?.startsWith("default.") ? "Default" : "Custom") },
          { header: "Description", cell: (p) => p.Description },
        ]} empty={<EmptyState title="No parameter groups" />} />
      </Container>
    </Page>
  );
}
