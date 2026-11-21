import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { aws, errorMessage } from "@/lib/emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Container, ErrorAlert, Header, KeyValue, buttonClass } from "@/components/ui";

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
  return (
    <Page>
      <Header
        variant="h1"
        info
        actions={
          <>
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
      {preview !== null && (
        <Container header={<Header>Preview</Header>}>
          <pre className="max-h-[480px] overflow-auto rounded-lg bg-[#f6f6f5] p-4 font-mono text-[13px] whitespace-pre-wrap">{preview}</pre>
        </Container>
      )}
    </Page>
  );
}
