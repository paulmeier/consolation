import Link from "next/link";
import { Suspense } from "react";
import { DescribeSecurityGroupsCommand, DescribeVpcsCommand, type SecurityGroup } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createSecurityGroup, deleteSecurityGroups } from "../actions";

export const metadata = { title: "Security Groups | EC2" };
const FORM = "sg-form";

async function Groups() {
  let groups: SecurityGroup[] = [];
  let vpcs: string[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    const [sg, v] = await Promise.all([ec2.send(new DescribeSecurityGroupsCommand({})), ec2.send(new DescribeVpcsCommand({}))]);
    groups = sg.SecurityGroups ?? [];
    vpcs = (v.Vpcs ?? []).map((x) => x.VpcId!);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={groups.length}
            info
            actions={
              <>
                <LinkButton href="/ec2/security-groups" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteSecurityGroups} label="Delete security groups" title="Delete security groups" noun="security group" confirmWord="delete" />
                <ModalButton label="Create security group" title="Create security group" variant="primary">
                  <form action={createSecurityGroup} className="space-y-4">
                    <FormField label="Security group name">
                      <Input name="name" required maxLength={255} autoFocus />
                    </FormField>
                    <FormField label="Description">
                      <Input name="description" required maxLength={255} />
                    </FormField>
                    <FormField label="VPC">
                      <Select name="vpc">{vpcs.map((v) => <option key={v}>{v}</option>)}</Select>
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create security group</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Security Groups
          </Header>
          <TableFilter tableId="sg-table" placeholder="Find resources by attribute or tag" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="sg-table"
        formId={FORM}
        selection="multi"
        rows={groups}
        rowKey={(g) => g.GroupId!}
        filterText={(g) => `${g.GroupId} ${g.GroupName} ${g.VpcId} ${g.Description}`}
        columns={[
          { header: "Security group ID", cell: (g) => <Link className="font-mono text-[13px] text-accent hover:underline" href={`/ec2/security-groups/${g.GroupId}`}>{g.GroupId}</Link> },
          { header: "Security group name", cell: (g) => g.GroupName },
          { header: "VPC ID", cell: (g) => <span className="font-mono text-[13px]">{g.VpcId ?? "-"}</span> },
          { header: "Description", cell: (g) => g.Description },
          { header: "Inbound rules", cell: (g) => `${g.IpPermissions?.length ?? 0} Permission entries` },
          { header: "Outbound rules", cell: (g) => `${g.IpPermissionsEgress?.length ?? 0} Permission entries` },
        ]}
        empty={<EmptyState title="No security groups" />}
      />
    </Container>
  );
}

export default function SgPage() {
  return (
    <Page wide>
      <Suspense fallback={<Container header={<Header>Security Groups</Header>}>Loading…</Container>}>
        <Groups />
      </Suspense>
    </Page>
  );
}
