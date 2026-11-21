import Link from "next/link";
import { Suspense } from "react";
import { ListBucketsCommand, type Bucket } from "@aws-sdk/client-s3";
import { aws, errorMessage, REGION } from "@/lib/emulator";
import { formatDate, regionLabel } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { deleteBuckets, emptyBuckets } from "../actions";

export const metadata = { title: "S3 buckets" };

const FORM = "buckets-form";

async function BucketTable() {
  let buckets: Bucket[] = [];
  let error: string | null = null;
  try {
    const { s3 } = await aws();
    buckets = (await s3.send(new ListBucketsCommand({}))).Buckets ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={buckets.length}
            info
            description="Buckets are containers for data stored in S3."
            actions={
              <>
                <LinkButton href="/s3/buckets" aria-label="Refresh" className="px-2">
                  <RefreshIcon />
                </LinkButton>
                <ConfirmAction formId={FORM} action={emptyBuckets} label="Empty" title="Empty bucket" noun="bucket" confirmWord="permanently delete" confirmLabel="Empty" description="Emptying a bucket deletes all objects in it. This can't be undone." />
                <ConfirmAction formId={FORM} action={deleteBuckets} label="Delete" title="Delete bucket" noun="bucket" description="Deleting a bucket can't be undone. The bucket must be empty." />
                <LinkButton href="/s3/buckets/create" variant="primary">
                  Create bucket
                </LinkButton>
              </>
            }
          >
            General purpose buckets
          </Header>
          <TableFilter tableId="buckets-table" placeholder="Find buckets by name" />
        </div>
      }
    >
      <form id={FORM} />
      {error && (
        <div className="px-5 pb-4">
          <ErrorAlert message={error} />
        </div>
      )}
      <Table
        id="buckets-table"
        formId={FORM}
        selection="single"
        rows={buckets}
        rowKey={(b) => b.Name!}
        filterText={(b) => b.Name!}
        columns={[
          {
            header: "Name",
            cell: (b) => (
              <Link className="underline-link" href={`/s3/buckets/${encodeURIComponent(b.Name!)}`}>
                {b.Name}
              </Link>
            ),
          },
          { header: "AWS Region", cell: (b) => `${regionLabel(b.BucketRegion ?? REGION)} ${b.BucketRegion ?? REGION}` },
          { header: "Creation date", cell: (b) => formatDate(b.CreationDate) },
        ]}
        empty={<EmptyState title="No buckets" description="You don't have any buckets." action={<LinkButton href="/s3/buckets/create">Create bucket</LinkButton>} />}
      />
    </Container>
  );
}

export default function BucketsPage() {
  return (
    <Page>
      <Header variant="h1">Buckets</Header>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Suspense fallback={<Container header={<Header>General purpose buckets</Header>}>Loading buckets…</Container>}>
          <BucketTable />
        </Suspense>
        <div className="space-y-5">
          <Container header={<Header info>Account snapshot</Header>}>
            <p className="text-sm text-muted">Storage Lens is not available in the emulator. Bucket and object counts are shown on Console Home.</p>
          </Container>
        </div>
      </div>
    </Page>
  );
}
