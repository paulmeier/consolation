import Link from "next/link";
import { ListHostedZonesCommand, type HostedZone } from "@aws-sdk/client-route-53";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createZone, deleteZones } from "../actions";

export const metadata = { title: "Hosted zones | Route 53" };

export default async function ZonesPage() {
  let zones: HostedZone[] = [];
  let error: string | null = null;
  try {
    const { route53 } = await aws();
    zones = (await route53.send(new ListHostedZonesCommand({ MaxItems: 100 }))).HostedZones ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  const id = (z: HostedZone) => z.Id!.replace("/hostedzone/", "");
  return (
    <Page>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={zones.length}
              info
              description="Automatic mode is the current search behavior optimized for best filter results."
              actions={
                <>
                  <LinkButton href="/route53/hosted-zones" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="zones-form" action={deleteZones} label="Delete" title="Delete hosted zone" noun="hosted zone" confirmWord="delete" description="Consolation first deletes every record in the zone except the apex NS and SOA records." />
                  <ModalButton label="Create hosted zone" title="Create hosted zone" variant="primary">
                    <form action={createZone} className="space-y-4">
                      <FormField label="Domain name" description="This is the name of the domain that you want to route traffic for."><Input name="name" required placeholder="example.com" autoFocus /></FormField>
                      <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="comment" /></FormField>
                      <FormField label="Type">
                        <div className="flex gap-6">
                          <label className="flex items-center gap-2"><input type="radio" name="type" value="public" defaultChecked className="accent-accent" /> Public hosted zone</label>
                          <label className="flex items-center gap-2"><input type="radio" name="type" value="private" className="accent-accent" /> Private hosted zone</label>
                        </div>
                      </FormField>
                      <FormField label="VPC ID (private zones)"><Input name="vpc" placeholder="vpc-…" /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create hosted zone</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Hosted zones
            </Header>
            <TableFilter tableId="zones-table" placeholder="Filter hosted zones by property or value" />
          </div>
        }
      >
        <form id="zones-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="zones-table"
          formId="zones-form"
          selection="multi"
          rows={zones}
          rowKey={id}
          filterText={(z) => `${z.Name} ${id(z)} ${z.Config?.Comment ?? ""}`}
          columns={[
            { header: "Hosted zone name", cell: (z) => <Link className="underline-link" href={`/route53/hosted-zones/${id(z)}`}>{z.Name}</Link> },
            { header: "Type", cell: (z) => (z.Config?.PrivateZone ? "Private" : "Public") },
            { header: "Created by", cell: () => "Route 53" },
            { header: "Record count", cell: (z) => z.ResourceRecordSetCount ?? 0, sortValue: (z) => z.ResourceRecordSetCount ?? 0 },
            { header: "Description", cell: (z) => z.Config?.Comment || "-" },
            { header: "Hosted zone ID", cell: (z) => <span className="font-mono text-[13px]">{id(z)}</span> },
          ]}
          empty={<EmptyState title="No hosted zones" />}
        />
      </Container>
    </Page>
  );
}
