import Link from "next/link";
import { DescribeRouteTablesCommand, DescribeVpcsCommand, type RouteTable } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createRouteTable, deleteRouteTables } from "../actions";
import { nameTag } from "../shared";

export const metadata = { title: "Route tables | VPC" };

export default async function RouteTablesPage() {
  let rts: RouteTable[] = [];
  let vpcs: string[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    [rts, vpcs] = await Promise.all([
      ec2.send(new DescribeRouteTablesCommand({})).then((r) => r.RouteTables ?? []),
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
          <div className="space-y-3">
            <Header
              counter={rts.length}
              info
              actions={
                <>
                  <LinkButton href="/vpc/route-tables" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="rt-form" action={deleteRouteTables} label="Delete route table" title="Delete route table" noun="route table" confirmWord="delete" description="Main route tables and tables with subnet associations can't be deleted." />
                  <ModalButton label="Create route table" title="Create route table" variant="primary">
                    <form action={createRouteTable} className="space-y-4">
                      <FormField label={<>Name <i className="font-normal text-muted">- optional</i></>}><Input name="name" autoFocus /></FormField>
                      <FormField label="VPC"><Select name="vpc">{vpcs.map((v) => <option key={v}>{v}</option>)}</Select></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create route table</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Route tables
            </Header>
            <TableFilter tableId="rt-table" placeholder="Filter route tables" />
          </div>
        }
      >
        <form id="rt-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="rt-table"
          formId="rt-form"
          selection="multi"
          rows={rts}
          rowKey={(r) => r.RouteTableId!}
          filterText={(r) => `${nameTag(r.Tags)} ${r.RouteTableId} ${r.VpcId}`}
          columns={[
            { header: "Name", cell: (r) => nameTag(r.Tags) },
            { header: "Route table ID", cell: (r) => <Link className="underline-link font-mono text-[13px]" href={`/vpc/route-tables/${r.RouteTableId}`}>{r.RouteTableId}</Link> },
            { header: "Explicit subnet associations", cell: (r) => (r.Associations ?? []).filter((a) => a.SubnetId).length || "-" },
            { header: "Main", cell: (r) => (r.Associations?.some((a) => a.Main) ? "Yes" : "No") },
            { header: "Routes", cell: (r) => r.Routes?.length ?? 0 },
            { header: "VPC", cell: (r) => <span className="font-mono text-[13px]">{r.VpcId}</span> },
          ]}
          empty={<EmptyState title="No route tables" />}
        />
      </Container>
    </Page>
  );
}
