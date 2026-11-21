import { DescribeRouteTablesCommand, DescribeVpcEndpointsCommand, DescribeVpcsCommand, type VpcEndpoint } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createEndpoint, deleteEndpoints } from "../actions";
import { ec2State, nameTag } from "../shared";

export const metadata = { title: "Endpoints | VPC" };

export default async function EndpointsPage() {
  let eps: VpcEndpoint[] = [];
  let vpcs: string[] = [];
  let rts: { id: string; vpc: string }[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    [eps, vpcs, rts] = await Promise.all([
      ec2.send(new DescribeVpcEndpointsCommand({})).then((r) => r.VpcEndpoints ?? []),
      ec2.send(new DescribeVpcsCommand({})).then((r) => (r.Vpcs ?? []).map((v) => v.VpcId!)),
      ec2.send(new DescribeRouteTablesCommand({})).then((r) => (r.RouteTables ?? []).map((t) => ({ id: t.RouteTableId!, vpc: t.VpcId! }))),
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
            counter={eps.length}
            info
            actions={
              <>
                <LinkButton href="/vpc/endpoints" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId="ep-form" action={deleteEndpoints} label="Delete VPC endpoints" title="Delete endpoints" noun="endpoint" confirmWord="delete" />
                <ModalButton label="Create endpoint" title="Create gateway endpoint" variant="primary">
                  <form action={createEndpoint} className="space-y-4">
                    <input type="hidden" name="type" value="Gateway" />
                    <FormField label={<>Name tag <i className="font-normal text-muted">- optional</i></>}><Input name="name" autoFocus /></FormField>
                    <FormField label="Service"><Select name="service">{["com.amazonaws.us-east-1.s3", "com.amazonaws.us-east-1.dynamodb"].map((s) => <option key={s}>{s}</option>)}</Select></FormField>
                    <FormField label="VPC"><Select name="vpc">{vpcs.map((v) => <option key={v}>{v}</option>)}</Select></FormField>
                    <FormField label="Route tables" description="Hold Ctrl/Cmd to pick several (must belong to the VPC).">
                      <Select name="routeTables" multiple size={Math.min(5, Math.max(2, rts.length))}>{rts.map((r) => <option key={r.id} value={r.id}>{r.id} ({r.vpc})</option>)}</Select>
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create endpoint</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Endpoints
          </Header>
        }
      >
        <form id="ep-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          formId="ep-form"
          selection="multi"
          rows={eps}
          rowKey={(e) => e.VpcEndpointId!}
          columns={[
            { header: "Name", cell: (e) => nameTag(e.Tags) },
            { header: "VPC endpoint ID", cell: (e) => <span className="font-mono text-[13px]">{e.VpcEndpointId}</span> },
            { header: "VPC ID", cell: (e) => e.VpcId },
            { header: "Service name", cell: (e) => e.ServiceName },
            { header: "Endpoint type", cell: (e) => e.VpcEndpointType },
            { header: "Status", cell: (e) => ec2State(e.State) },
            { header: "Creation time", cell: (e) => formatDate(e.CreationTimestamp) },
          ]}
          empty={<EmptyState title="No endpoints" />}
        />
      </Container>
    </Page>
  );
}
