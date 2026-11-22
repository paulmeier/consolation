import Link from "next/link";
import { DescribeExportCommand, ListExportsCommand, type ExportDescription } from "@aws-sdk/client-dynamodb";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Container, EmptyState, ErrorAlert, Header } from "@/components/ui";
import { exportStatus } from "../exports-panel";

export const metadata = { title: "Exports to S3 | DynamoDB" };

export default async function ExportsPage() {
  let rows: ExportDescription[] = [];
  let error: string | null = null;
  try {
    const { dynamodb } = await aws();
    const list = (await dynamodb.send(new ListExportsCommand({}))).ExportSummaries ?? [];
    rows = await Promise.all(list.map(async (e) => (await dynamodb.send(new DescribeExportCommand({ ExportArn: e.ExportArn! }))).ExportDescription ?? { ExportArn: e.ExportArn }));
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container noPadding header={<Header variant="h1" counter={rows.length} description="Start an export from a table's Exports and streams tab.">Exports to S3</Header>}>
        <Table
          rows={rows}
          rowKey={(e) => e.ExportArn!}
          columns={[
            { header: "Table", cell: (e) => { const t = e.TableArn?.split("/")[1]; return t ? <Link className="text-accent hover:underline" href={`/dynamodb/tables/${encodeURIComponent(t)}?tab=streams`}>{t}</Link> : "-"; } },
            { header: "Status", cell: (e) => exportStatus(e.ExportStatus) },
            { header: "Destination", cell: (e) => `s3://${e.S3Bucket}/${e.S3Prefix ?? ""}` },
            { header: "Format", cell: (e) => e.ExportFormat },
            { header: "Items", cell: (e) => e.ItemCount ?? "-" },
            { header: "Started", cell: (e) => formatDate(e.StartTime) },
            { header: "Completed", cell: (e) => formatDate(e.EndTime) },
          ]}
          empty={<EmptyState title="No exports" />}
        />
      </Container>
    </Page>
  );
}
