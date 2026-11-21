import { DescribeVpcPeeringConnectionsCommand, DescribeVpcsCommand, type VpcPeeringConnection } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { acceptPeering, createPeering, deletePeering } from "../actions";
import { ec2State, nameTag } from "../shared";

export const metadata = { title: "Peering connections | VPC" };

export default async function PeeringPage() {
  let pcx: VpcPeeringConnection[] = [];
  let vpcs: string[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    [pcx, vpcs] = await Promise.all([
      ec2.send(new DescribeVpcPeeringConnectionsCommand({})).then((r) => r.VpcPeeringConnections ?? []),
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
          <Header
            counter={pcx.length}
            info
            actions={
              <>
                <LinkButton href="/vpc/peering" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId="pcx-form" action={acceptPeering} label="Accept request" title="Accept peering request" noun="peering connection" confirmWord="accept" confirmLabel="Accept" />
                <ConfirmAction formId="pcx-form" action={deletePeering} label="Delete" title="Delete peering connection" noun="peering connection" confirmWord="delete" />
                <ModalButton label="Create peering connection" title="Create peering connection" variant="primary">
                  <form action={createPeering} className="space-y-4">
                    <FormField label={<>Name <i className="font-normal text-muted">- optional</i></>}><Input name="name" autoFocus /></FormField>
                    <FormField label="VPC ID (Requester)"><Select name="requester">{vpcs.map((v) => <option key={v}>{v}</option>)}</Select></FormField>
                    <FormField label="VPC ID (Accepter)"><Select name="accepter">{vpcs.map((v) => <option key={v}>{v}</option>)}</Select></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create peering connection</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Peering connections
          </Header>
        }
      >
        <form id="pcx-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          formId="pcx-form"
          selection="multi"
          rows={pcx}
          rowKey={(p) => p.VpcPeeringConnectionId!}
          columns={[
            { header: "Name", cell: (p) => nameTag(p.Tags) },
            { header: "Peering connection ID", cell: (p) => <span className="font-mono text-[13px]">{p.VpcPeeringConnectionId}</span> },
            { header: "Status", cell: (p) => ec2State(p.Status?.Code) },
            { header: "Requester VPC", cell: (p) => `${p.RequesterVpcInfo?.VpcId} (${p.RequesterVpcInfo?.CidrBlock})` },
            { header: "Accepter VPC", cell: (p) => `${p.AccepterVpcInfo?.VpcId} (${p.AccepterVpcInfo?.CidrBlock ?? "-"})` },
          ]}
          empty={<EmptyState title="No peering connections" />}
        />
      </Container>
    </Page>
  );
}
