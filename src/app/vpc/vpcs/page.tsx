import Link from "next/link";
import { DescribeVpcsCommand, type Vpc } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createVpc, deleteVpcs } from "../actions";
import { ec2State, nameTag } from "../shared";

export const metadata = { title: "Your VPCs | VPC" };

export default async function VpcsPage() {
  let vpcs: Vpc[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    vpcs = (await ec2.send(new DescribeVpcsCommand({}))).Vpcs ?? [];
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
              counter={vpcs.length}
              info
              actions={
                <>
                  <LinkButton href="/vpc/vpcs" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="vpcs-form" action={deleteVpcs} label="Delete VPC" title="Delete VPC" noun="VPC" confirmWord="delete" description="Attached internet gateways are detached and deleted too. Delete subnets, NAT gateways and endpoints in the VPC first." />
                  <ModalButton label="Create VPC" title="Create VPC" variant="primary">
                    <form action={createVpc} className="space-y-4">
                      <FormField label={<>Name tag <i className="font-normal text-muted">- optional</i></>}><Input name="name" placeholder="my-vpc-01" autoFocus /></FormField>
                      <FormField label="IPv4 CIDR" constraint="CIDR block size must be between /16 and /28."><Input name="cidr" required defaultValue="10.0.0.0/16" pattern="\d+\.\d+\.\d+\.\d+\/\d+" /></FormField>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="dnsHostnames" defaultChecked className="accent-accent" /> Enable DNS hostnames</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="withIgw" className="accent-accent" /> Create and attach an internet gateway</label>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create VPC</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Your VPCs
            </Header>
            <TableFilter tableId="vpcs-table" placeholder="Filter VPCs" />
          </div>
        }
      >
        <form id="vpcs-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="vpcs-table"
          formId="vpcs-form"
          selection="multi"
          rows={vpcs}
          rowKey={(v) => v.VpcId!}
          filterText={(v) => `${nameTag(v.Tags)} ${v.VpcId} ${v.CidrBlock}`}
          columns={[
            { header: "Name", cell: (v) => nameTag(v.Tags) },
            { header: "VPC ID", cell: (v) => <Link className="underline-link font-mono text-[13px]" href={`/vpc/vpcs/${v.VpcId}`}>{v.VpcId}</Link> },
            { header: "State", cell: (v) => ec2State(v.State) },
            { header: "IPv4 CIDR", cell: (v) => v.CidrBlock },
            { header: "DHCP option set", cell: (v) => v.DhcpOptionsId ?? "-" },
            { header: "Tenancy", cell: (v) => v.InstanceTenancy },
            { header: "Default VPC", cell: (v) => (v.IsDefault ? "Yes" : "No") },
            { header: "Owner ID", cell: (v) => v.OwnerId },
          ]}
          empty={<EmptyState title="No VPCs found in this Region" />}
        />
      </Container>
    </Page>
  );
}
