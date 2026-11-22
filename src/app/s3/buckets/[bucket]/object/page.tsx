import { GetObjectCommand, GetObjectLockConfigurationCommand, GetObjectTaggingCommand, HeadObjectCommand, ListObjectVersionsCommand } from "@aws-sdk/client-s3";
import { aws, errorMessage } from "@/lib/emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ModalButton } from "@/components/client/modal";
import { Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, Textarea, buttonClass } from "@/components/ui";
import { copyObject, saveObjectRetention, saveObjectTags, setLegalHold } from "../../../actions";
import { PresignForm } from "../../../presign";

const PREVIEWABLE = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml))/;

export default async function ObjectPage({ params, searchParams }: PageProps<"/s3/buckets/[bucket]/object">) {
  const bucket = decodeURIComponent((await params).bucket);
  const key = String((await searchParams).key ?? "");
  const { s3 } = await aws();
  let head;
  let preview: string | null = null;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if ((head.ContentLength ?? 0) <= 256 * 1024 && PREVIEWABLE.test(head.ContentType ?? "")) {
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      preview = (await obj.Body?.transformToString()) ?? "";
    }
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{key.split("/").pop()}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const download = `/api/s3/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
  const [tags, versions, lock] = await Promise.all([
    s3.send(new GetObjectTaggingCommand({ Bucket: bucket, Key: key })).then((r) => r.TagSet ?? []).catch(() => []),
    s3.send(new ListObjectVersionsCommand({ Bucket: bucket, Prefix: key })).then((r) => (r.Versions ?? []).filter((v) => v.Key === key)).catch(() => []),
    s3.send(new GetObjectLockConfigurationCommand({ Bucket: bucket })).then((r) => r.ObjectLockConfiguration?.ObjectLockEnabled === "Enabled").catch(() => false),
  ]);
  const retainUntil = head.ObjectLockRetainUntilDate;
  const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const defaultUntil = retainUntil ?? new Date(new Date().getTime() + 86400_000);
  const hidden = (
    <>
      <input type="hidden" name="bucket" value={bucket} />
      <input type="hidden" name="key" value={key} />
    </>
  );
  return (
    <Page>
      <Header
        variant="h1"
        info
        actions={
          <>
            <ModalButton label="Copy or move" title="Copy or move object">
              <form action={copyObject} className="space-y-4">
                {hidden}
                <FormField label="Destination bucket"><Input name="destBucket" defaultValue={bucket} required /></FormField>
                <FormField label="Destination key" description="Use a new key in the same bucket to rename."><Input name="destKey" defaultValue={key} required /></FormField>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="move" className="accent-accent" /> Move (delete the source after copying)</label>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Copy</button></div>
              </form>
            </ModalButton>
            <ModalButton label="Share with a presigned URL" title="Share with a presigned URL" keepOpen>
              <PresignForm bucket={bucket} objectKey={key} />
            </ModalButton>
            <a href={download} className={buttonClass("normal")}>Download</a>
            <a href={`${download}&inline=1`} target="_blank" rel="noreferrer" className={buttonClass("primary")}>Open</a>
          </>
        }
      >
        {key.split("/").pop()}
      </Header>
      <Container header={<Header>Object overview</Header>}>
        <KeyValue
          items={[
            { label: "Bucket", value: bucket },
            { label: "Key", value: <span className="break-all">{key}</span> },
            { label: "S3 URI", value: <span className="font-mono text-[13px] break-all">s3://{bucket}/{key}</span> },
            { label: "Size", value: formatBytes(head.ContentLength) },
            { label: "Type", value: head.ContentType },
            { label: "Last modified", value: formatDate(head.LastModified) },
            { label: "Entity tag (Etag)", value: <span className="font-mono text-[13px]">{head.ETag}</span> },
            { label: "Storage class", value: head.StorageClass ?? "Standard" },
            { label: "Version ID", value: head.VersionId ?? "null" },
          ]}
        />
      </Container>
      <Container header={<Header description="One Key=Value per line. Empty and save to remove all tags.">Tags ({tags.length})</Header>}>
        <form action={saveObjectTags} className="space-y-3">
          {hidden}
          <Textarea name="tags" rows={3} defaultValue={tags.map((t) => `${t.Key}=${t.Value}`).join("\n")} placeholder="classification=internal" />
          <div className="flex justify-end"><button className={buttonClass("normal")}>Save tags</button></div>
        </form>
      </Container>
      {lock && (
        <Container
          header={
            <Header
              description="Retention and legal hold for this object version (Object Lock)."
              actions={
                <>
                  <form action={setLegalHold}>
                    {hidden}
                    <input type="hidden" name="versionId" value={head.VersionId ?? ""} />
                    <input type="hidden" name="on" value={String(head.ObjectLockLegalHoldStatus !== "ON")} />
                    <button className={buttonClass("normal")}>{head.ObjectLockLegalHoldStatus === "ON" ? "Remove legal hold" : "Apply legal hold"}</button>
                  </form>
                  <ModalButton label="Edit retention" title="Object Lock retention">
                    <form action={saveObjectRetention} className="space-y-4">
                      {hidden}
                      <input type="hidden" name="versionId" value={head.VersionId ?? ""} />
                      <FormField label="Retention mode">
                        <Select name="mode" defaultValue={head.ObjectLockMode ?? "GOVERNANCE"}>
                          <option value="GOVERNANCE">Governance</option>
                          <option value="COMPLIANCE">Compliance</option>
                          <option value="">Disable (governance mode only, with bypass)</option>
                        </Select>
                      </FormField>
                      <FormField label="Retain until"><Input name="until" type="datetime-local" required defaultValue={localInput(defaultUntil)} /></FormField>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="bypass" className="accent-accent" /> Bypass governance retention</label>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Object Lock
            </Header>
          }
        >
          <KeyValue
            items={[
              { label: "Retention mode", value: head.ObjectLockMode ?? "None" },
              { label: "Retain until", value: retainUntil ? formatDate(retainUntil) : "-" },
              { label: "Legal hold", value: head.ObjectLockLegalHoldStatus === "ON" ? "On" : "Off" },
            ]}
          />
        </Container>
      )}
      {versions.length > 1 && (
        <Container noPadding header={<Header counter={versions.length}>Versions</Header>}>
          <Table
            rows={versions}
            rowKey={(v) => v.VersionId ?? "null"}
            columns={[
              { header: "Version ID", cell: (v) => <span className="font-mono text-xs">{v.VersionId}{v.IsLatest && <Badge color="blue">Current</Badge>}</span> },
              { header: "Last modified", cell: (v) => formatDate(v.LastModified) },
              { header: "Size", cell: (v) => formatBytes(v.Size), sortValue: (v) => v.Size ?? 0 },
            ]}
            empty={<EmptyState title="No versions" />}
          />
        </Container>
      )}
      {preview !== null && (
        <Container header={<Header>Preview</Header>}>
          <pre className="max-h-[480px] overflow-auto rounded-lg bg-code p-4 font-mono text-[13px] whitespace-pre-wrap">{preview}</pre>
        </Container>
      )}
    </Page>
  );
}
