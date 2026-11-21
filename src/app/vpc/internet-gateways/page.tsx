import { DescribeInternetGatewaysCommand, DescribeVpcsCommand, type InternetGateway } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { attachIgw, createIgw, deleteIgws, detachIgw } from "../actions";
import { ec2State, nameTag } from "../shared";

export const metadata = { title: "Internet gateways | VPC" };

export default async function IgwPage() {
  let igws: InternetGateway[] = [];
  let vpcs: string[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    [igws, vpcs] = await Promise.all([
      ec2.send(new DescribeInternetGatewaysCommand({})).then((r) => r.InternetGateways ?? []),
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
            counter={igws.length}
            info
            actions={
              <>
                <LinkButton href="/vpc/internet-gateways" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId="igw-form" action={detachIgw} label="Detach from VPC" title="Detach from VPC" noun="internet gateway" confirmWord="detach" confirmLabel="Detach" />
                <ConfirmAction
                  formId="igw-form"
                  action={attachIgw}
                  label="Attach to VPC"
                  title="Attach to VPC"
                  noun="internet gateway"
                  confirmWord="attach"
                  confirmLabel="Attach"
                  description="An internet gateway can be attached to one VPC."
                  fields={<div className="space-y-1"><label className="block text-sm font-bold">VPC</label><Select name="vpc">{vpcs.map((v) => <option key={v}>{v}</option>)}</Select></div>}
                />
                <ConfirmAction formId="igw-form" action={deleteIgws} label="Delete" title="Delete internet gateway" noun="internet gateway" confirmWord="delete" description="Detach the gateway first." />
                <ModalButton label="Create internet gateway" title="Create internet gateway" variant="primary">
                  <form action={createIgw} className="space-y-4">
                    <FormField label={<>Name tag <i className="font-normal text-muted">- optional</i></>}><Input name="name" autoFocus /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create internet gateway</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Internet gateways
          </Header>
        }
      >
        <form id="igw-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          formId="igw-form"
          selection="multi"
          rows={igws}
          rowKey={(g) => `${g.InternetGatewayId}|${g.Attachments?.[0]?.VpcId ?? ""}`}
          columns={[
            { header: "Name", cell: (g) => nameTag(g.Tags) },
            { header: "Internet gateway ID", cell: (g) => <span className="font-mono text-[13px]">{g.InternetGatewayId}</span> },
            { header: "State", cell: (g) => ec2State(g.Attachments?.[0]?.State ?? "detached") },
            { header: "VPC ID", cell: (g) => g.Attachments?.[0]?.VpcId ?? "-" },
            { header: "Owner", cell: (g) => g.OwnerId },
          ]}
          empty={<EmptyState title="No internet gateways" />}
        />
      </Container>
    </Page>
  );
}
