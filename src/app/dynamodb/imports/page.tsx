import Link from "next/link";
import { DescribeImportCommand, ListImportsCommand, type ImportTableDescription } from "@aws-sdk/client-dynamodb";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { importTable } from "../actions";
import { exportStatus } from "../exports-panel";

export const metadata = { title: "Imports from S3 | DynamoDB" };

export default async function ImportsPage() {
  let rows: ImportTableDescription[] = [];
  let buckets: string[] = [];
  let error: string | null = null;
  try {
    const { dynamodb, s3 } = await aws();
    const [list, b] = await Promise.all([dynamodb.send(new ListImportsCommand({})), s3.send(new ListBucketsCommand({}))]);
    buckets = (b.Buckets ?? []).map((x) => x.Name!);
    rows = await Promise.all(
      (list.ImportSummaryList ?? []).map(async (i) => (await dynamodb.send(new DescribeImportCommand({ ImportArn: i.ImportArn! }))).ImportTableDescription ?? { ImportArn: i.ImportArn }),
    );
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            variant="h1"
            counter={rows.length}
            description="Create a new table from data in Amazon S3 (DynamoDB JSON, Amazon Ion or CSV)."
            actions={
              <ModalButton label="Import from S3" title="Import from S3" variant="primary" size="lg">
                <form action={importTable} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Source S3 bucket"><Select name="bucket">{buckets.map((b) => <option key={b}>{b}</option>)}</Select></FormField>
                    <FormField label={<>Key prefix <i className="font-normal text-muted">- optional</i></>}><Input name="prefix" placeholder="AWSDynamoDB/…/data/" /></FormField>
                    <FormField label="Import file format">
                      <Select name="format" defaultValue="DYNAMODB_JSON">
                        <option value="DYNAMODB_JSON">DynamoDB JSON</option>
                        <option value="ION">Amazon Ion</option>
                        <option value="CSV">CSV</option>
                      </Select>
                    </FormField>
                    <FormField label="Compression">
                      <Select name="compression" defaultValue="GZIP">
                        <option value="NONE">No compression</option>
                        <option value="GZIP">GZIP</option>
                        <option value="ZSTD">ZSTD</option>
                      </Select>
                    </FormField>
                    <FormField label="New table name"><Input name="name" required pattern="[A-Za-z0-9_.\-]{3,255}" /></FormField>
                    <div />
                    <FormField label="Partition key"><Input name="pk" required /></FormField>
                    <FormField label="Partition key type"><Select name="pkType" defaultValue="S"><option value="S">String</option><option value="N">Number</option><option value="B">Binary</option></Select></FormField>
                    <FormField label={<>Sort key <i className="font-normal text-muted">- optional</i></>}><Input name="sk" /></FormField>
                    <FormField label="Sort key type"><Select name="skType" defaultValue="S"><option value="S">String</option><option value="N">Number</option><option value="B">Binary</option></Select></FormField>
                  </div>
                  <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!buckets.length}>Import</button></div>
                </form>
              </ModalButton>
            }
          >
            Imports from S3
          </Header>
        }
      >
        <Table
          rows={rows}
          rowKey={(i) => i.ImportArn!}
          columns={[
            { header: "Table", cell: (i) => { const t = i.TableArn?.split("/")[1]; return t ? <Link className="text-accent hover:underline" href={`/dynamodb/tables/${encodeURIComponent(t)}`}>{t}</Link> : "-"; } },
            { header: "Status", cell: (i) => exportStatus(i.ImportStatus) },
            { header: "Source", cell: (i) => `s3://${i.S3BucketSource?.S3Bucket}/${i.S3BucketSource?.S3KeyPrefix ?? ""}` },
            { header: "Format", cell: (i) => i.InputFormat },
            { header: "Items imported", cell: (i) => i.ImportedItemCount ?? "-" },
            { header: "Errors", cell: (i) => i.ErrorCount ?? 0 },
            { header: "Started", cell: (i) => formatDate(i.StartTime) },
          ]}
          empty={<EmptyState title="No imports" />}
        />
      </Container>
    </Page>
  );
}
