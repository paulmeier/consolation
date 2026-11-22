import { DescribeContinuousBackupsCommand, ListExportsCommand, type ExportSummary } from "@aws-sdk/client-dynamodb";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { aws, errorMessage } from "@/lib/emulator";
import { Table } from "@/components/table";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, StatusIndicator, buttonClass } from "@/components/ui";
import { exportTable } from "./actions";

export function exportStatus(s?: string) {
  if (s === "COMPLETED") return <StatusIndicator type="success">Completed</StatusIndicator>;
  if (s === "FAILED") return <StatusIndicator type="error">Failed</StatusIndicator>;
  return <StatusIndicator type="pending">{s === "IN_PROGRESS" ? "In progress" : (s ?? "-")}</StatusIndicator>;
}

/** Exports to S3 for one table (ExportTableToPointInTime needs point-in-time recovery). */
export async function ExportsPanel({ table, arn }: { table: string; arn: string }) {
  let exports: ExportSummary[] = [];
  let buckets: string[] = [];
  let pitr = false;
  let error: string | null = null;
  try {
    const { dynamodb, s3 } = await aws();
    const [e, b, c] = await Promise.all([
      dynamodb.send(new ListExportsCommand({ TableArn: arn })),
      s3.send(new ListBucketsCommand({})),
      dynamodb.send(new DescribeContinuousBackupsCommand({ TableName: table })),
    ]);
    exports = e.ExportSummaries ?? [];
    buckets = (b.Buckets ?? []).map((x) => x.Name!);
    pitr = c.ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus === "ENABLED";
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <Header
          counter={exports.length}
          description="Export a point-in-time copy of the table to Amazon S3 in DynamoDB JSON or Amazon Ion."
          actions={
            <ModalButton label="Export to S3" title="Export table to Amazon S3" variant="primary">
              <form action={exportTable} className="space-y-4">
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="arn" value={arn} />
                <FormField label="Destination S3 bucket">
                  <Select name="bucket">{buckets.map((b) => <option key={b}>{b}</option>)}</Select>
                </FormField>
                {buckets.length === 0 && <p className="text-sm text-muted">No buckets. Create one in Amazon S3 first.</p>}
                <FormField label={<>S3 prefix <i className="font-normal text-muted">- optional</i></>}><Input name="prefix" /></FormField>
                <FormField label="Exported file format">
                  <Select name="format" defaultValue="DYNAMODB_JSON">
                    <option value="DYNAMODB_JSON">DynamoDB JSON</option>
                    <option value="ION">Amazon Ion</option>
                  </Select>
                </FormField>
                {!pitr && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="enablePitr" defaultChecked className="mt-1 accent-accent" />
                    <span>Turn on point-in-time recovery for this table. Exports need it.</span>
                  </label>
                )}
                <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!buckets.length}>Export</button></div>
              </form>
            </ModalButton>
          }
        >
          Exports to S3
        </Header>
      }
    >
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        rows={exports}
        rowKey={(e) => e.ExportArn!}
        columns={[
          { header: "Export ARN", cell: (e) => <span className="font-mono text-[13px] break-all">{e.ExportArn}</span> },
          { header: "Status", cell: (e) => exportStatus(e.ExportStatus) },
          { header: "Type", cell: (e) => e.ExportType ?? "FULL_EXPORT" },
        ]}
        empty={<EmptyState title="No exports" />}
      />
    </Container>
  );
}
