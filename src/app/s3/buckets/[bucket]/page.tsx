import Link from "next/link";
import { Suspense } from "react";
import {
  GetBucketCorsCommand,
  GetBucketEncryptionCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketLocationCommand,
  GetBucketPolicyCommand,
  GetBucketTaggingCommand,
  GetBucketVersioningCommand,
  GetBucketWebsiteCommand,
  GetPublicAccessBlockCommand,
  GetBucketNotificationConfigurationCommand,
  GetBucketReplicationCommand,
  GetObjectLockConfigurationCommand,
  ListBucketInventoryConfigurationsCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
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
import { Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import {
  createFolder,
  deleteInventories,
  deleteObjects,
  deleteVersions,
  saveBucketJson,
  saveBucketTags,
  saveEncryption,
  saveInventory,
  saveNotifications,
  saveObjectLock,
  savePublicAccessBlock,
  saveReplication,
  saveWebsite,
  setVersioning,
} from "../../actions";
import { UploadPanel } from "../../upload-panel";

const FORM = "objects-form";

type Row = { kind: "folder"; key: string } | { kind: "object"; key: string; obj: _Object };

const objectHref = (bucket: string, key: string) => `/s3/buckets/${encodeURIComponent(bucket)}/object?key=${encodeURIComponent(key)}`;
const pretty = (v: unknown) => (v === undefined || v === null ? "" : JSON.stringify(v, null, 2));
const safe = async <T,>(p: Promise<T>) => p.catch(() => undefined);

async function Objects({ bucket, prefix, token, versions }: { bucket: string; prefix: string; token?: string; versions: boolean }) {
  const base = `/s3/buckets/${encodeURIComponent(bucket)}`;
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (prefix) p.set("prefix", prefix);
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  let rows: Row[] = [];
  let versionRows: { key: string; versionId: string; latest: boolean; marker: boolean; size?: number; modified?: Date }[] = [];
  let next: string | undefined;
  let error: string | null = null;
  try {
    const { s3 } = await aws();
    if (versions) {
      const r = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }));
      versionRows = [
        ...(r.Versions ?? []).map((v) => ({ key: v.Key!, versionId: v.VersionId ?? "null", latest: !!v.IsLatest, marker: false, size: v.Size, modified: v.LastModified })),
        ...(r.DeleteMarkers ?? []).map((m) => ({ key: m.Key!, versionId: m.VersionId ?? "null", latest: !!m.IsLatest, marker: true, modified: m.LastModified })),
      ].sort((a, b) => a.key.localeCompare(b.key) || (b.modified?.getTime() ?? 0) - (a.modified?.getTime() ?? 0));
    } else {
      const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/", MaxKeys: 1000, ContinuationToken: token }));
      rows = [
        ...(res.CommonPrefixes ?? []).map((p) => ({ kind: "folder" as const, key: p.Prefix! })),
        ...(res.Contents ?? []).filter((o) => o.Key !== prefix).map((o) => ({ kind: "object" as const, key: o.Key!, obj: o })),
      ];
      next = res.IsTruncated ? res.NextContinuationToken : undefined;
    }
  } catch (e) {
    error = errorMessage(e);
  }
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
            counter={versions ? versionRows.length : rows.length}
            info
            description="Objects are the fundamental entities stored in Amazon S3."
            actions={
              <>
                <LinkButton href={q({ versions: versions ? "1" : undefined })} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                {versions ? (
                  <ConfirmAction formId={FORM} action={deleteVersions} extra={{ bucket }} label="Delete" title="Delete object versions" noun="version" confirmWord="permanently delete" description="Deleting specific versions can't be undone." />
                ) : (
                  <ConfirmAction formId={FORM} action={deleteObjects} extra={{ bucket }} label="Delete" title="Delete objects" noun="item" confirmWord="permanently delete" description="Folders are deleted with everything in them. In a versioned bucket this adds delete markers." />
                )}
                <ModalButton label="Create folder" title="Create folder">
                  <form action={createFolder} className="space-y-4">
                    {hidden}
                    <FormField label="Folder name" constraint="Folder names can't contain &quot;/&quot;."><Input name="name" required pattern="[^\/]+" autoFocus /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create folder</button></div>
                  </form>
                </ModalButton>
                <ModalButton label="Upload" title="Upload" variant="primary" size="lg">
                  <UploadPanel bucket={bucket} prefix={prefix} />
                </ModalButton>
              </>
            }
          >
            Objects
          </Header>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {prefix ? (
              <nav className="text-sm">
                <Link href={base} className="underline-link">{bucket}</Link>
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
            ) : <span />}
            <Link href={q({ versions: versions ? undefined : "1" })} className="flex items-center gap-2 text-sm">
              <span className={`relative inline-block h-4 w-7 rounded-full ${versions ? "bg-accent" : "bg-line-strong"}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${versions ? "left-3.5" : "left-0.5"}`} /></span>
              Show versions
            </Link>
          </div>
          <TableFilter tableId="objects-table" placeholder="Find objects by prefix" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      {versions ? (
        <Table
          id="objects-table"
          formId={FORM}
          selection="multi"
          rows={versionRows}
          rowKey={(v) => JSON.stringify([v.key, v.versionId])}
          filterText={(v) => v.key}
          columns={[
            { header: "Name", cell: (v) => (v.marker ? <span className="text-muted">{v.key.slice(prefix.length)}</span> : <Link className="underline-link" href={objectHref(bucket, v.key)}>{v.key.slice(prefix.length)}</Link>) },
            { header: "Type", cell: (v) => (v.marker ? <Badge color="red">Delete marker</Badge> : (v.key.split(".").pop() ?? "-")) },
            { header: "Version ID", cell: (v) => <span className="font-mono text-xs">{v.versionId}{v.latest && <Badge color="blue">Current</Badge>}</span> },
            { header: "Last modified", cell: (v) => formatDate(v.modified) },
            { header: "Size", cell: (v) => (v.marker ? "-" : formatBytes(v.size)), sortValue: (v) => v.size ?? 0 },
          ]}
          empty={<EmptyState title="No versions" />}
        />
      ) : (
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
      )}
      {(token || next) && (
        <div className="flex justify-between border-t border-line px-5 py-3 text-sm">
          {token ? <Link href={q({})} className="underline-link">First page</Link> : <span />}
          {next && <Link href={q({ token: next })} className="underline-link">Load next 1,000 objects</Link>}
        </div>
      )}
    </Container>
  );
}

async function Properties({ bucket }: { bucket: string }) {
  const { s3 } = await aws();
  const [loc, ver, tags, enc, web, notif, lock] = await Promise.all([
    safe(s3.send(new GetBucketLocationCommand({ Bucket: bucket }))),
    safe(s3.send(new GetBucketVersioningCommand({ Bucket: bucket }))),
    safe(s3.send(new GetBucketTaggingCommand({ Bucket: bucket }))),
    safe(s3.send(new GetBucketEncryptionCommand({ Bucket: bucket }))),
    safe(s3.send(new GetBucketWebsiteCommand({ Bucket: bucket }))),
    safe(s3.send(new GetBucketNotificationConfigurationCommand({ Bucket: bucket }))),
    safe(s3.send(new GetObjectLockConfigurationCommand({ Bucket: bucket }))),
  ]);
  const notifications = [
    ...(notif?.QueueConfigurations ?? []).map((c) => ({ id: c.Id, type: "SQS queue", dest: c.QueueArn, events: c.Events })),
    ...(notif?.TopicConfigurations ?? []).map((c) => ({ id: c.Id, type: "SNS topic", dest: c.TopicArn, events: c.Events })),
    ...(notif?.LambdaFunctionConfigurations ?? []).map((c) => ({ id: c.Id, type: "Lambda function", dest: c.LambdaFunctionArn, events: c.Events })),
    ...(notif?.EventBridgeConfiguration ? [{ id: "EventBridge", type: "Amazon EventBridge", dest: "default event bus", events: ["All events"] }] : []),
  ];
  const notifJson = notif ? pretty({ QueueConfigurations: notif.QueueConfigurations, TopicConfigurations: notif.TopicConfigurations, LambdaFunctionConfigurations: notif.LambdaFunctionConfigurations, EventBridgeConfiguration: notif.EventBridgeConfiguration }) : "";
  const notifSample = pretty({ QueueConfigurations: [{ Id: "new-objects", QueueArn: `arn:aws:sqs:${REGION}:000000000000:my-queue`, Events: ["s3:ObjectCreated:*"], Filter: { Key: { FilterRules: [{ Name: "prefix", Value: "uploads/" }] } } }] });
  const lockRule = lock?.ObjectLockConfiguration?.Rule?.DefaultRetention;
  const region = loc?.LocationConstraint || REGION;
  const versioning = ver?.Status ?? "Disabled";
  const rule = enc?.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault;
  const hidden = <input type="hidden" name="bucket" value={bucket} />;
  return (
    <>
      <Container header={<Header>Bucket overview</Header>}>
        <KeyValue items={[
          { label: "AWS Region", value: `${regionLabel(region)} ${region}` },
          { label: "Amazon Resource Name (ARN)", value: <span className="font-mono text-[13px]">arn:aws:s3:::{bucket}</span> },
          { label: "S3 URI", value: <span className="font-mono text-[13px]">s3://{bucket}</span> },
        ]} />
      </Container>
      <Container
        header={
          <Header info description="Keep multiple variants of an object in the same bucket." actions={
            <form action={setVersioning}>{hidden}<input type="hidden" name="status" value={versioning === "Enabled" ? "Suspended" : "Enabled"} /><button className={buttonClass("normal")}>{versioning === "Enabled" ? "Suspend" : "Enable"}</button></form>
          }>Bucket Versioning</Header>
        }
      >
        <KeyValue items={[{ label: "Bucket Versioning", value: versioning === "Enabled" ? <StatusIndicator type="success">Enabled</StatusIndicator> : versioning }]} />
      </Container>
      <Container header={<Header description="One Key=Value per line. Empty and save to remove all tags.">Tags ({tags?.TagSet?.length ?? 0})</Header>}>
        <form action={saveBucketTags} className="space-y-3">
          {hidden}
          <Textarea name="tags" rows={4} defaultValue={(tags?.TagSet ?? []).map((t) => `${t.Key}=${t.Value}`).join("\n")} placeholder="project=demo" />
          <div className="flex justify-end"><button className={buttonClass("normal")}>Save tags</button></div>
        </form>
      </Container>
      <Container header={<Header info description="Server-side encryption applied to new objects.">Default encryption</Header>}>
        <form action={saveEncryption} className="space-y-4">
          {hidden}
          <FormField label="Encryption type">
            <Select name="algo" defaultValue={rule?.SSEAlgorithm ?? "AES256"}>
              <option value="AES256">Server-side encryption with Amazon S3 managed keys (SSE-S3)</option>
              <option value="aws:kms">Server-side encryption with AWS KMS keys (SSE-KMS)</option>
              <option value="none">Remove default encryption</option>
            </Select>
          </FormField>
          <FormField label="KMS key (SSE-KMS)"><Input name="kmsKey" defaultValue={rule?.KMSMasterKeyID ?? ""} placeholder="arn:aws:kms:… or alias/…" /></FormField>
          <div className="flex justify-end"><button className={buttonClass("normal")}>Save changes</button></div>
        </form>
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={notifications.length}
            info
            description="Send a message to SQS, SNS, Lambda or EventBridge when objects are created, deleted or restored."
            actions={
              <ModalButton label="Edit event notifications" title="Event notifications" size="lg">
                <form action={saveNotifications} className="space-y-3">
                  {hidden}
                  <p className="text-sm text-muted">The bucket&apos;s whole notification configuration as JSON. Empty and save to remove all notifications.</p>
                  <Textarea name="json" rows={14} spellCheck={false} defaultValue={notifJson === "{}" ? notifSample : notifJson || notifSample} />
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="grant" defaultChecked className="mt-1 accent-accent" />
                    <span>Update each SQS destination&apos;s access policy so this bucket can send to it. S3 checks this when you save.</span>
                  </label>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            Event notifications
          </Header>
        }
      >
        <Table
          rows={notifications}
          rowKey={(n) => `${n.type}:${n.id}:${n.dest}`}
          columns={[
            { header: "Name", cell: (n) => n.id ?? "-" },
            { header: "Event types", cell: (n) => (n.events ?? []).join(", ") },
            { header: "Destination type", cell: (n) => n.type },
            { header: "Destination", cell: (n) => <span className="font-mono text-[13px] break-all">{n.dest}</span> },
          ]}
          empty={<EmptyState title="No event notifications" />}
        />
      </Container>
      <Container
        header={
          <Header
            info
            description="Prevent objects from being deleted or overwritten for a fixed time or indefinitely."
            actions={
              lock && (
                <ModalButton label="Edit" title="Object Lock default retention">
                  <form action={saveObjectLock} className="space-y-4">
                    {hidden}
                    <FormField label="Default retention mode">
                      <Select name="mode" defaultValue={lockRule?.Mode ?? ""}>
                        <option value="">No default retention</option>
                        <option value="GOVERNANCE">Governance</option>
                        <option value="COMPLIANCE">Compliance</option>
                      </Select>
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Retention period"><Input name="period" type="number" min={1} defaultValue={String(lockRule?.Days ?? lockRule?.Years ?? 1)} /></FormField>
                      <FormField label="Unit">
                        <Select name="unit" defaultValue={lockRule?.Years ? "Years" : "Days"}>
                          <option>Days</option>
                          <option>Years</option>
                        </Select>
                      </FormField>
                    </div>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                  </form>
                </ModalButton>
              )
            }
          >
            Object Lock
          </Header>
        }
      >
        <KeyValue
          items={[
            { label: "Object Lock", value: lock ? <StatusIndicator type="success">Enabled</StatusIndicator> : "Disabled (can only be turned on when the bucket is created)" },
            { label: "Default retention mode", value: lockRule?.Mode ?? "-" },
            { label: "Default retention period", value: lockRule?.Days ? `${lockRule.Days} days` : lockRule?.Years ? `${lockRule.Years} years` : "-" },
          ]}
        />
      </Container>
      <Container header={<Header info>Static website hosting</Header>}>
        <form action={saveWebsite} className="space-y-4">
          {hidden}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={!!web} className="accent-accent" /> Enable static website hosting</label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Index document"><Input name="index" defaultValue={web?.IndexDocument?.Suffix ?? "index.html"} /></FormField>
            <FormField label={<>Error document <i className="font-normal text-muted">- optional</i></>}><Input name="error" defaultValue={web?.ErrorDocument?.Key ?? ""} /></FormField>
          </div>
          {web && <p className="text-sm text-muted">Bucket website endpoint: <span className="font-mono">http://{bucket}.s3-website-{region}.amazonaws.com</span></p>}
          <div className="flex justify-end"><button className={buttonClass("normal")}>Save changes</button></div>
        </form>
      </Container>
    </>
  );
}

function JsonEditor({ bucket, kind, title, description, value, placeholder }: { bucket: string; kind: string; title: string; description: string; value: string; placeholder: string }) {
  return (
    <Container header={<Header info description={`${description} Empty and save to delete it.`}>{title}</Header>}>
      <form action={saveBucketJson} className="space-y-3">
        <input type="hidden" name="bucket" value={bucket} />
        <input type="hidden" name="kind" value={kind} />
        <Textarea name="json" rows={12} defaultValue={value} placeholder={placeholder} spellCheck={false} />
        <div className="flex justify-end"><button className={buttonClass("normal")}>Save changes</button></div>
      </form>
    </Container>
  );
}

async function Permissions({ bucket }: { bucket: string }) {
  const { s3 } = await aws();
  const [pab, policy, cors] = await Promise.all([
    safe(s3.send(new GetPublicAccessBlockCommand({ Bucket: bucket }))),
    safe(s3.send(new GetBucketPolicyCommand({ Bucket: bucket }))),
    safe(s3.send(new GetBucketCorsCommand({ Bucket: bucket }))),
  ]);
  const c = pab?.PublicAccessBlockConfiguration;
  let policyText = policy?.Policy ?? "";
  try {
    if (policyText) policyText = JSON.stringify(JSON.parse(policyText), null, 2);
  } catch {}
  return (
    <>
      <Container header={<Header info description="As on AWS, these settings make the emulator reject public bucket policies and ACLs. Turn off the policy settings before saving a public bucket policy.">Block public access (bucket settings)</Header>}>
        <form action={savePublicAccessBlock} className="space-y-2 text-sm">
          <input type="hidden" name="bucket" value={bucket} />
          {[
            ["blockAcls", "Block public access granted through new ACLs", c?.BlockPublicAcls],
            ["ignoreAcls", "Block public access granted through any ACLs", c?.IgnorePublicAcls],
            ["blockPolicy", "Block public access granted through new bucket policies", c?.BlockPublicPolicy],
            ["restrict", "Block public and cross-account access through any bucket policies", c?.RestrictPublicBuckets],
          ].map(([name, label, on]) => (
            <label key={String(name)} className="flex items-center gap-2"><input type="checkbox" name={String(name)} defaultChecked={on === undefined ? true : !!on} className="accent-accent" /> {String(label)}</label>
          ))}
          <div className="flex justify-end"><button className={buttonClass("normal")}>Save changes</button></div>
        </form>
      </Container>
      <JsonEditor bucket={bucket} kind="policy" title="Bucket policy" description="Written in JSON." value={policyText} placeholder='{"Version": "2012-10-17", "Statement": [...]}' />
      <JsonEditor bucket={bucket} kind="cors" title="Cross-origin resource sharing (CORS)" description="A JSON array of CORS rules." value={pretty(cors?.CORSRules)} placeholder='[{"AllowedMethods": ["GET"], "AllowedOrigins": ["*"]}]' />
    </>
  );
}

async function Management({ bucket }: { bucket: string }) {
  const { s3 } = await aws();
  const [lc, repl, inv] = await Promise.all([
    safe(s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }))),
    safe(s3.send(new GetBucketReplicationCommand({ Bucket: bucket }))),
    safe(s3.send(new ListBucketInventoryConfigurationsCommand({ Bucket: bucket }))),
  ]);
  const sample = pretty([{ ID: "expire-tmp", Status: "Enabled", Filter: { Prefix: "tmp/" }, Expiration: { Days: 7 } }]);
  const replSample = pretty({
    Role: "arn:aws:iam::000000000000:role/s3-replication",
    Rules: [{ ID: "replicate-all", Status: "Enabled", Priority: 1, Filter: {}, DeleteMarkerReplication: { Status: "Disabled" }, Destination: { Bucket: "arn:aws:s3:::destination-bucket" } }],
  });
  const hidden = <input type="hidden" name="bucket" value={bucket} />;
  const inventories = inv?.InventoryConfigurationList ?? [];
  return (
    <>
      <Container noPadding header={<Header counter={lc?.Rules?.length ?? 0}>Lifecycle rules</Header>}>
        <Table
          rows={lc?.Rules ?? []}
          rowKey={(r) => r.ID ?? JSON.stringify(r)}
          columns={[
            { header: "Lifecycle rule name", cell: (r) => r.ID ?? "-" },
            { header: "Status", cell: (r) => r.Status },
            { header: "Scope", cell: (r) => (r.Filter?.Prefix ? `Prefix ${r.Filter.Prefix}` : "Entire bucket") },
            { header: "Expiration", cell: (r) => (r.Expiration?.Days ? `${r.Expiration.Days} days` : "-") },
            { header: "Transitions", cell: (r) => (r.Transitions ?? []).map((t) => `${t.StorageClass} after ${t.Days}d`).join(", ") || "-" },
          ]}
          empty={<EmptyState title="No lifecycle rules" />}
        />
      </Container>
      <JsonEditor bucket={bucket} kind="lifecycle" title="Edit lifecycle rules" description="A JSON array of lifecycle rules." value={pretty(lc?.Rules) || sample} placeholder={sample} />
      <Container
        noPadding
        header={
          <Header
            counter={repl?.ReplicationConfiguration?.Rules?.length ?? 0}
            info
            description="Copy objects to another bucket automatically. Both buckets need versioning enabled."
            actions={
              <ModalButton label="Edit replication" title="Replication configuration" size="lg">
                <form action={saveReplication} className="space-y-3">
                  {hidden}
                  <p className="text-sm text-muted">Empty and save to delete the configuration.</p>
                  <Textarea name="json" rows={14} spellCheck={false} defaultValue={repl?.ReplicationConfiguration ? pretty(repl.ReplicationConfiguration) : replSample} />
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            Replication rules
          </Header>
        }
      >
        <Table
          rows={repl?.ReplicationConfiguration?.Rules ?? []}
          rowKey={(r) => r.ID ?? JSON.stringify(r)}
          columns={[
            { header: "Replication rule name", cell: (r) => r.ID ?? "-" },
            { header: "Status", cell: (r) => r.Status },
            { header: "Destination bucket", cell: (r) => r.Destination?.Bucket?.replace("arn:aws:s3:::", "") },
            { header: "Priority", cell: (r) => r.Priority ?? "-" },
            { header: "Scope", cell: (r) => (r.Filter?.Prefix ? `Prefix ${r.Filter.Prefix}` : "Entire bucket") },
            { header: "Storage class", cell: (r) => r.Destination?.StorageClass ?? "Same as source" },
          ]}
          empty={<EmptyState title="No replication rules" />}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={inventories.length}
            info
            description="Scheduled reports listing the objects in the bucket and their metadata."
            actions={
              <>
                <ConfirmAction formId="inv-form" action={deleteInventories} extra={{ bucket }} label="Delete" title="Delete inventory configuration" noun="inventory configuration" />
                <ModalButton label="Create inventory configuration" title="Create inventory configuration">
                  <form action={saveInventory} className="space-y-4">
                    {hidden}
                    <FormField label="Inventory configuration name"><Input name="id" required pattern="[\w.\-]{1,64}" /></FormField>
                    <FormField label={<>Prefix <i className="font-normal text-muted">- optional</i></>}><Input name="prefix" /></FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Destination bucket"><Input name="destination" required /></FormField>
                      <FormField label={<>Destination prefix <i className="font-normal text-muted">- optional</i></>}><Input name="destPrefix" /></FormField>
                      <FormField label="Frequency"><Select name="frequency" defaultValue="Daily"><option>Daily</option><option>Weekly</option></Select></FormField>
                      <FormField label="Output format"><Select name="format" defaultValue="CSV"><option>CSV</option><option>ORC</option><option>Parquet</option></Select></FormField>
                      <FormField label="Object versions"><Select name="versions" defaultValue="Current"><option value="Current">Current version only</option><option value="All">Include all versions</option></Select></FormField>
                      <FormField label="Status"><Select name="enabled" defaultValue="on"><option value="on">Enable</option><option value="off">Disable</option></Select></FormField>
                    </div>
                    <fieldset>
                      <legend className="mb-1 text-sm font-bold">Additional metadata fields</legend>
                      {["Size", "LastModifiedDate", "StorageClass", "ETag", "EncryptionStatus", "ObjectLockMode"].map((f) => (
                        <label key={f} className="mr-4 inline-flex items-center gap-1.5 text-sm"><input type="checkbox" name="fields" value={f} defaultChecked={f === "Size" || f === "LastModifiedDate"} className="accent-accent" /> {f}</label>
                      ))}
                    </fieldset>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Inventory configurations
          </Header>
        }
      >
        <form id="inv-form" />
        <Table
          formId="inv-form"
          selection="multi"
          rows={inventories}
          rowKey={(i) => i.Id!}
          columns={[
            { header: "Name", cell: (i) => i.Id },
            { header: "Status", cell: (i) => (i.IsEnabled ? "Enabled" : "Disabled") },
            { header: "Scope", cell: (i) => (i.Filter?.Prefix ? `Prefix ${i.Filter.Prefix}` : "Entire bucket") },
            { header: "Destination", cell: (i) => `s3://${i.Destination?.S3BucketDestination?.Bucket?.replace("arn:aws:s3:::", "")}/${i.Destination?.S3BucketDestination?.Prefix ?? ""}` },
            { header: "Frequency", cell: (i) => i.Schedule?.Frequency },
            { header: "Format", cell: (i) => i.Destination?.S3BucketDestination?.Format },
          ]}
          empty={<EmptyState title="No inventory configurations" />}
        />
      </Container>
    </>
  );
}

export default async function BucketPage({ params, searchParams }: PageProps<"/s3/buckets/[bucket]">) {
  const bucket = decodeURIComponent((await params).bucket);
  const sp = await searchParams;
  const tab = ["properties", "permissions", "management"].includes(String(sp.tab)) ? String(sp.tab) : "objects";
  const prefix = typeof sp.prefix === "string" ? sp.prefix : "";
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const versions = sp.versions === "1";
  return (
    <Page wide>
      <Header variant="h1" info>{bucket}</Header>
      <Tabs
        base={`/s3/buckets/${encodeURIComponent(bucket)}`}
        active={tab}
        tabs={[
          { id: "objects", label: "Objects" },
          { id: "properties", label: "Properties" },
          { id: "permissions", label: "Permissions" },
          { id: "management", label: "Management" },
        ]}
      />
      <Suspense key={`${tab}:${prefix}:${token}:${versions}`} fallback={<Container>Loading…</Container>}>
        {tab === "objects" && <Objects bucket={bucket} prefix={prefix} token={token} versions={versions} />}
        {tab === "properties" && <Properties bucket={bucket} />}
        {tab === "permissions" && <Permissions bucket={bucket} />}
        {tab === "management" && <Management bucket={bucket} />}
      </Suspense>
    </Page>
  );
}
