import { ListLayersCommand, ListLayerVersionsCommand } from "@aws-sdk/client-lambda";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, buttonClass } from "@/components/ui";
import { deleteLayerVersions, publishLayer } from "../actions";
import { RUNTIMES } from "../templates";

export const metadata = { title: "Layers | Lambda" };

export default async function LayersPage() {
  let rows: { layer: string; version: number; arn: string; description?: string; runtimes: string; created?: string }[] = [];
  let error: string | null = null;
  try {
    const { lambda } = await aws();
    const layers = (await lambda.send(new ListLayersCommand({}))).Layers ?? [];
    rows = (
      await Promise.all(
        layers.map(async (l) =>
          ((await lambda.send(new ListLayerVersionsCommand({ LayerName: l.LayerName }))).LayerVersions ?? []).map((v) => ({
            layer: l.LayerName!,
            version: v.Version!,
            arn: v.LayerVersionArn!,
            description: v.Description,
            runtimes: (v.CompatibleRuntimes ?? []).join(", "),
            created: v.CreatedDate,
          })),
        ),
      )
    ).flat();
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <Header
            counter={rows.length}
            info
            description="Layers package libraries and other dependencies to share across functions. Attach them from a function's Configuration tab."
            actions={
              <>
                <ConfirmAction formId="layers-form" action={deleteLayerVersions} label="Delete" title="Delete layer versions" noun="layer version" confirmWord="delete" />
                <ModalButton label="Create layer" title="Create layer" variant="primary">
                  <form action={publishLayer} className="space-y-4">
                    <FormField label="Name"><Input name="layer" required pattern="[A-Za-z0-9_\-]+" autoFocus /></FormField>
                    <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                    <FormField label=".zip file"><input type="file" name="zip" accept=".zip" required className="block text-sm" /></FormField>
                    <FormField label="Compatible runtimes">
                      <div className="flex flex-wrap gap-3">{RUNTIMES.map((r) => <label key={r.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="runtimes" value={r.id} className="accent-accent" /> {r.label}</label>)}</div>
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Layers
          </Header>
        }
      >
        <form id="layers-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          formId="layers-form"
          selection="multi"
          rows={rows}
          rowKey={(r) => `${r.layer}|${r.version}`}
          columns={[
            { header: "Name", cell: (r) => r.layer },
            { header: "Version", cell: (r) => r.version, sortValue: (r) => r.version },
            { header: "Description", cell: (r) => r.description || "-" },
            { header: "Compatible runtimes", cell: (r) => r.runtimes || "-" },
            { header: "Version ARN", cell: (r) => <span className="font-mono text-xs break-all">{r.arn}</span> },
            { header: "Created", cell: (r) => formatDate(r.created) },
          ]}
          empty={<EmptyState title="No layers" />}
        />
      </Container>
    </Page>
  );
}
