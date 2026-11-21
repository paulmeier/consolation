import { DescribeAddressesCommand, type Address } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { allocateEip, releaseEips } from "../actions";
import { nameTag } from "../shared";

export const metadata = { title: "Elastic IP addresses | VPC" };

export default async function EipPage() {
  let addrs: Address[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    addrs = (await ec2.send(new DescribeAddressesCommand({}))).Addresses ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <Header
            counter={addrs.length}
            info
            actions={
              <>
                <LinkButton href="/vpc/elastic-ips" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId="eip-form" action={releaseEips} label="Release Elastic IP address" title="Release Elastic IP addresses" noun="address" confirmWord="release" confirmLabel="Release" />
                <ModalButton label="Allocate Elastic IP address" title="Allocate Elastic IP address" variant="primary">
                  <form action={allocateEip} className="space-y-4">
                    <FormField label={<>Name tag <i className="font-normal text-muted">- optional</i></>}><Input name="name" autoFocus /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Allocate</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Elastic IP addresses
          </Header>
        }
      >
        <form id="eip-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          formId="eip-form"
          selection="multi"
          rows={addrs}
          rowKey={(a) => a.AllocationId!}
          columns={[
            { header: "Name", cell: (a) => nameTag(a.Tags) },
            { header: "Allocated IPv4 address", cell: (a) => a.PublicIp },
            { header: "Type", cell: (a) => (a.Domain === "vpc" ? "Public IP" : a.Domain) },
            { header: "Allocation ID", cell: (a) => <span className="font-mono text-[13px]">{a.AllocationId}</span> },
            { header: "Associated instance ID", cell: (a) => a.InstanceId ?? "-" },
            { header: "Private IP address", cell: (a) => a.PrivateIpAddress ?? "-" },
            { header: "Association ID", cell: (a) => a.AssociationId ?? "-" },
          ]}
          empty={<EmptyState title="No Elastic IP addresses" />}
        />
      </Container>
    </Page>
  );
}
