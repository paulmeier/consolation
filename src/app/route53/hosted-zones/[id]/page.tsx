import { GetHostedZoneCommand, ListResourceRecordSetsCommand, type ResourceRecordSet } from "@aws-sdk/client-route-53";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, Select, Textarea, buttonClass } from "@/components/ui";
import { deleteRecords, deleteZones, upsertRecord } from "../../actions";

const TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "SRV", "CAA", "PTR", "SPF", "NAPTR", "DS"];

function RecordForm({ zone, zoneName, rec }: { zone: string; zoneName: string; rec?: ResourceRecordSet }) {
  const sub = rec ? rec.Name!.replace(/\\052/g, "*").slice(0, -(zoneName.length + 1)).replace(/\.$/, "") : "";
  return (
    <form action={upsertRecord} className="space-y-4">
      <input type="hidden" name="zone" value={zone} />
      <input type="hidden" name="zoneName" value={zoneName.replace(/\.$/, "")} />
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <FormField label="Record name" description={`Subdomain of ${zoneName} (empty for the apex).`}>
          <Input name="name" defaultValue={sub} placeholder="www" readOnly={!!rec} />
        </FormField>
        <span className="pb-1.5 text-sm text-muted">.{zoneName}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Record type"><Select name="type" defaultValue={rec?.Type ?? "A"} disabled={!!rec}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></FormField>
        <FormField label="TTL (seconds)"><Input name="ttl" type="number" min={0} defaultValue={rec?.TTL ?? 300} /></FormField>
      </div>
      {rec && <input type="hidden" name="type" value={rec.Type} />}
      <FormField label="Value" description="One value per line. TXT values need quotes.">
        <Textarea name="value" rows={4} defaultValue={(rec?.ResourceRecords ?? []).map((r) => r.Value).join("\n")} placeholder="192.0.2.235" />
      </FormField>
      <details className="rounded-lg border border-line p-3" open={!!rec?.AliasTarget || !!rec?.SetIdentifier}>
        <summary className="cursor-pointer font-bold">Alias and routing policy</summary>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="alias" defaultChecked={!!rec?.AliasTarget} className="accent-accent" /> Alias (route to another record or AWS resource)</label>
          <FormField label="Alias target DNS name"><Input name="aliasTarget" defaultValue={rec?.AliasTarget?.DNSName} placeholder="other.example.com." /></FormField>
          <FormField label="Alias target hosted zone ID" description="Defaults to this zone."><Input name="aliasZone" defaultValue={rec?.AliasTarget?.HostedZoneId} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Weighted: record ID"><Input name="setId" defaultValue={rec?.SetIdentifier} readOnly={!!rec?.SetIdentifier} /></FormField>
            <FormField label="Weight"><Input name="weight" type="number" min={0} max={255} defaultValue={rec?.Weight} /></FormField>
          </div>
        </div>
      </details>
      <div className="flex justify-end"><button className={buttonClass("primary")}>{rec ? "Save" : "Create records"}</button></div>
    </form>
  );
}

export default async function ZonePage({ params }: PageProps<"/route53/hosted-zones/[id]">) {
  const id = decodeURIComponent((await params).id);
  const { route53 } = await aws();
  let data;
  try {
    data = await Promise.all([route53.send(new GetHostedZoneCommand({ Id: id })), route53.send(new ListResourceRecordSetsCommand({ HostedZoneId: id, MaxItems: 300 }))]);
  } catch (e) {
    return (<Page><Header variant="h1">{id}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const [z, recs] = data;
  const zone = z.HostedZone!;
  const records = recs.ResourceRecordSets ?? [];
  const key = (r: ResourceRecordSet) => JSON.stringify(r);
  const ns = z.DelegationSet?.NameServers ?? records.find((r) => r.Type === "NS" && r.Name === zone.Name)?.ResourceRecords?.map((v) => v.Value!) ?? [];
  return (
    <Page wide>
      <Header variant="h1" info actions={<ConfirmAction values={[id]} extra={{ from: "detail" }} action={deleteZones} label="Delete zone" title="Delete hosted zone" noun="hosted zone" confirmWord="delete" />}>
        {zone.Name}
      </Header>
      <Container header={<Header>Hosted zone details</Header>}>
        <KeyValue
          items={[
            { label: "Hosted zone ID", value: <span className="font-mono text-[13px]">{id}</span> },
            { label: "Type", value: zone.Config?.PrivateZone ? "Private hosted zone" : "Public hosted zone" },
            { label: "Record count", value: zone.ResourceRecordSetCount ?? records.length },
            { label: "Description", value: zone.Config?.Comment || "-" },
            { label: "Name servers", value: ns.length ? <span className="font-mono text-[13px]">{ns.join(", ")}</span> : "-" },
            ...(z.VPCs?.length ? [{ label: "VPCs", value: z.VPCs.map((v) => v.VPCId).join(", ") }] : []),
          ]}
        />
      </Container>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={records.length}
              actions={
                <>
                  <LinkButton href={`/route53/hosted-zones/${id}`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="rec-form" action={deleteRecords} extra={{ zone: id }} label="Delete record" title="Delete records" noun="record" confirmWord="delete" />
                  <ModalButton label="Create record" title="Quick create record" variant="primary" size="lg">
                    <RecordForm zone={id} zoneName={zone.Name!} />
                  </ModalButton>
                </>
              }
            >
              Records
            </Header>
            <TableFilter tableId="rec-table" placeholder="Filter records by property or value" />
          </div>
        }
      >
        <form id="rec-form" />
        <Table
          id="rec-table"
          formId="rec-form"
          selection="multi"
          rows={records}
          rowKey={key}
          filterText={(r) => `${r.Name} ${r.Type} ${(r.ResourceRecords ?? []).map((v) => v.Value).join(" ")} ${r.AliasTarget?.DNSName ?? ""}`}
          columns={[
            { header: "Record name", cell: (r) => r.Name?.replace(/\\052/g, "*") },
            { header: "Type", cell: (r) => r.Type },
            { header: "Routing policy", cell: (r) => (r.Weight !== undefined ? "Weighted" : "Simple") },
            { header: "Alias", cell: (r) => (r.AliasTarget ? "Yes" : "No") },
            { header: "Value/Route traffic to", cell: (r) => <span className="font-mono text-[13px] break-all whitespace-pre-line">{r.AliasTarget ? r.AliasTarget.DNSName : (r.ResourceRecords ?? []).map((v) => v.Value).join("\n")}</span> },
            { header: "TTL (seconds)", cell: (r) => r.TTL ?? "-" },
            { header: "Record ID", cell: (r) => r.SetIdentifier ?? "-" },
            { header: "", sortable: false, cell: (r) => (r.Type === "SOA" || (r.Type === "NS" && r.Name === zone.Name) ? null : <ModalButton label="Edit" title={`Edit record ${r.Name}`} size="lg"><RecordForm zone={id} zoneName={zone.Name!} rec={r} /></ModalButton>) },
          ]}
          empty={<EmptyState title="No records" />}
        />
      </Container>
    </Page>
  );
}
