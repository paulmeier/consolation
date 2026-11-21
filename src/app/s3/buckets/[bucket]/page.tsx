import Link from "next/link";
import { Suspense } from "react";
import {
  GetBucketLocationCommand,
  GetBucketVersioningCommand,
  ListObjectsV2Command,
  type _Object,
} from "@aws-sdk/client-s3";
import { aws, errorMessage, REGION } from "@/lib/emulator";
import { formatBytes, formatDate, regionLabel } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, StatusIndicator, buttonClass } from "@/components/ui";
import { createFolder, deleteObjects, setVersioning, uploadObjects } from "../../actions";

const FORM = "objects-form";

type Row = { kind: "folder"; key: string } | { kind: "object"; key: string; obj: _Object };

function objectHref(bucket: string, key: string) {
  return `/s3/buckets/${encodeURIComponent(bucket)}/object?key=${encodeURIComponent(key)}`;
}

async function Objects({ bucket, prefix }: { bucket: string; prefix: string }) {
  let rows: Row[] = [];
  let error: string | null = null;
  try {
    const { s3 } = await aws();
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/", MaxKeys: 1000 }));
    rows = [
      ...(res.CommonPrefixes ?? []).map((p) => ({ kind: "folder" as const, key: p.Prefix! })),
      ...(res.Contents ?? []).filter((o) => o.Key !== prefix).map((o) => ({ kind: "object" as const, key: o.Key!, obj: o })),
    ];
  } catch (e) {
    error = errorMessage(e);
  }
  const base = `/s3/buckets/${encodeURIComponent(bucket)}`;
  const hidden = (
    <>
      <input type="hidden" name="bucket" value={bucket} />
      <input type="hidden" name="prefix" value={prefix} />
    </>
  );
  const parts = prefix.split("/").filter(Boolean);

  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={rows.length}
            info
            description="Objects are the fundamental entities stored in Amazon S3. You can use the emulator's S3 API to get a list of all objects in your bucket."
            actions={
              <>
                <LinkButton href={prefix ? `${base}?prefix=${encodeURIComponent(prefix)}` : base} aria-label="Refresh" className="px-2">
                  <RefreshIcon />
                </LinkButton>
                <ConfirmAction formId={FORM} action={deleteObjects} extra={{ bucket }} label="Delete" title="Delete objects" noun="item" confirmWord="permanently delete" description="Deleting the specified objects can't be undone. Folders are deleted with everything in them." />
                <ModalButton label="Create folder" title="Create folder">
                  <form action={createFolder} className="space-y-4">
                    {hidden}
                    <FormField label="Folder name" constraint="Folder names can't contain &quot;/&quot;.">
                      <Input name="name" required pattern="[^/]+" autoFocus />
                    </FormField>
                    <div className="flex justify-end">
                      <button className={buttonClass("primary")}>Create folder</button>
                    </div>
                  </form>
                </ModalButton>
                <ModalButton label="Upload" title="Upload" variant="primary">
                  <form action={uploadObjects} className="space-y-4">
                    {hidden}
                    <p className="text-sm text-muted">
                      Destination: <span className="font-mono">s3://{bucket}/{prefix}</span>
                    </p>
                    <input type="file" name="files" multiple required className="block w-full rounded border-2 border-dashed border-line-strong p-6 text-sm" />
                    <div className="flex justify-end">
                      <button className={buttonClass("primary")}>Upload</button>
                    </div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Objects
          </Header>
          {prefix && (
            <nav className="text-sm">
              <Link href={base} className="underline-link">
                {bucket}
              </Link>
              {parts.map((p, i) => {
                const pre = parts.slice(0, i + 1).join("/") + "/";
                return (
                  <span key={pre}>
                    <span className="mx-1.5 text-subtle">/</span>
                    {i === parts.length - 1 ? <span>{p}</span> : <Link href={`${base}?prefix=${encodeURIComponent(pre)}`} className="underline-link">{p}</Link>}
                  </span>
                );
              })}
            </nav>
          )}
          <TableFilter tableId="objects-table" placeholder="Find objects by prefix" />
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
        id="objects-table"
        formId={FORM}
        selection="multi"
        rows={rows}
        rowKey={(r) => r.key}
        filterText={(r) => r.key.slice(prefix.length)}
        columns={[
          {
            header: "Name",
            cell: (r) =>
              r.kind === "folder" ? (
                <Link href={`${base}?prefix=${encodeURIComponent(r.key)}`} className="underline-link inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 3.5h5l1.5 2h6.5v7h-13z" /></svg>
                  {r.key.slice(prefix.length)}
                </Link>
              ) : (
                <Link href={objectHref(bucket, r.key)} className="underline-link inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 1.5h6l3 3v10h-9z" /></svg>
                  {r.key.slice(prefix.length)}
                </Link>
              ),
          },
          { header: "Type", cell: (r) => (r.kind === "folder" ? "Folder" : (r.key.split(".").pop() ?? "-")) },
          { header: "Last modified", cell: (r) => (r.kind === "object" ? formatDate(r.obj.LastModified) : "-") },
          { header: "Size", cell: (r) => (r.kind === "object" ? formatBytes(r.obj.Size) : "-"), sortValue: (r) => (r.kind === "object" ? (r.obj.Size ?? 0) : -1) },
          { header: "Storage class", cell: (r) => (r.kind === "object" ? (r.obj.StorageClass ?? "Standard") : "-") },
        ]}
        empty={<EmptyState title="No objects" description="You don't have any objects in this bucket." />}
      />
    </Container>
  );
}

async function Properties({ bucket }: { bucket: string }) {
  const { s3 } = await aws();
  let region = REGION;
  let versioning = "Disabled";
  let error: string | null = null;
  try {
    const loc = await s3.send(new GetBucketLocationCommand({ Bucket: bucket }));
    region = loc.LocationConstraint || "us-east-1";
  } catch (e) {
    error = errorMessage(e);
  }
  try {
    const v = await s3.send(new GetBucketVersioningCommand({ Bucket: bucket }));
    versioning = v.Status ?? "Disabled";
  } catch (e) {
    error ??= errorMessage(e);
  }
  return (
    <>
      {error && <ErrorAlert message={error} />}
      <Container header={<Header>Bucket overview</Header>}>
        <KeyValue
          items={[
            { label: "AWS Region", value: `${regionLabel(region)} ${region}` },
            { label: "Amazon Resource Name (ARN)", value: <span className="font-mono text-[13px]">arn:aws:s3:::{bucket}</span> },
            { label: "S3 URI", value: <span className="font-mono text-[13px]">s3://{bucket}</span> },
          ]}
        />
      </Container>
      <Container
        header={
          <Header
            info
            description="Versioning is a means of keeping multiple variants of an object in the same bucket."
            actions={
              <form action={setVersioning}>
                <input type="hidden" name="bucket" value={bucket} />
                <input type="hidden" name="status" value={versioning === "Enabled" ? "Suspended" : "Enabled"} />
                <button className={buttonClass("normal")}>{versioning === "Enabled" ? "Suspend" : "Enable"}</button>
              </form>
            }
          >
            Bucket Versioning
          </Header>
        }
      >
        <KeyValue items={[{ label: "Bucket Versioning", value: versioning === "Enabled" ? <StatusIndicator type="success">Enabled</StatusIndicator> : versioning }]} />
      </Container>
    </>
  );
}

export default async function BucketPage({ params, searchParams }: PageProps<"/s3/buckets/[bucket]">) {
  const { bucket: raw } = await params;
  const bucket = decodeURIComponent(raw);
  const sp = await searchParams;
  const tab = sp.tab === "properties" ? "properties" : "objects";
  const prefix = typeof sp.prefix === "string" ? sp.prefix : "";
  return (
    <Page>
      <Header variant="h1" info>
        {bucket}
      </Header>
      <Tabs
        base={`/s3/buckets/${encodeURIComponent(bucket)}`}
        active={tab}
        tabs={[
          { id: "objects", label: "Objects" },
          { id: "properties", label: "Properties" },
        ]}
      />
      <Suspense key={`${tab}:${prefix}`} fallback={<Container>Loading…</Container>}>
        {tab === "objects" ? <Objects bucket={bucket} prefix={prefix} /> : <Properties bucket={bucket} />}
      </Suspense>
    </Page>
  );
}
