import { ListExportsCommand, type Export } from "@aws-sdk/client-cloudformation";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { Container, EmptyState, ErrorAlert, Header } from "@/components/ui";

export const metadata = { title: "Exports | CloudFormation" };

export default async function ExportsPage() {
  let exports: Export[] = [];
  let error: string | null = null;
  try {
    const { cfn } = await aws();
    exports = (await cfn.send(new ListExportsCommand({}))).Exports ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <Container noPadding header={<div className="space-y-3"><Header counter={exports.length} info>Exports</Header><TableFilter tableId="exp-table" placeholder="Filter exports" /></div>}>
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="exp-table"
          rows={exports}
          rowKey={(e) => e.Name!}
          filterText={(e) => `${e.Name} ${e.Value}`}
          columns={[
            { header: "Export name", cell: (e) => e.Name },
            { header: "Export value", cell: (e) => <span className="font-mono text-[13px] break-all">{e.Value}</span> },
            { header: "Exporting stack", cell: (e) => <span className="font-mono text-xs break-all">{e.ExportingStackId?.split("/")[1]}</span> },
          ]}
          empty={<EmptyState title="No exports" />}
        />
      </Container>
    </Page>
  );
}
