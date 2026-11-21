import { DescribeImageScanFindingsCommand, DescribeImagesCommand, DescribeRepositoriesCommand, GetLifecyclePolicyCommand, GetRepositoryPolicyCommand } from "@aws-sdk/client-ecr";
import { aws, errorMessage } from "@/lib/emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Alert, Badge, Code, Container, EmptyState, ErrorAlert, FormField, Header, KeyValue, LinkButton, RefreshIcon, Select, Textarea, buttonClass } from "@/components/ui";
import { deleteImages, deleteRepositories, saveSettings, savePolicy, scanImage } from "../../actions";

const LIFECYCLE_SAMPLE = JSON.stringify({ rules: [{ rulePriority: 1, description: "Expire untagged images older than 14 days", selection: { tagStatus: "untagged", countType: "sinceImagePushed", countUnit: "days", countNumber: 14 }, action: { type: "expire" } }] }, null, 2);

function pretty(s?: string) {
  if (!s) return "";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export default async function RepoPage({ params, searchParams }: PageProps<"/ecr/repositories/[name]">) {
  const name = decodeURIComponent((await params).name);
  const sp = await searchParams;
  const tab = String(sp.tab ?? "images");
  const digest = typeof sp.digest === "string" ? sp.digest : undefined;
  const { ecr } = await aws();
  let data;
  try {
    data = await Promise.all([
      ecr.send(new DescribeRepositoriesCommand({ repositoryNames: [name] })),
      ecr.send(new DescribeImagesCommand({ repositoryName: name, maxResults: 1000 })).catch(() => ({ imageDetails: [] })),
      ecr.send(new GetLifecyclePolicyCommand({ repositoryName: name })).catch(() => ({ lifecyclePolicyText: undefined })),
      ecr.send(new GetRepositoryPolicyCommand({ repositoryName: name })).catch(() => ({ policyText: undefined })),
      digest ? ecr.send(new DescribeImageScanFindingsCommand({ repositoryName: name, imageId: { imageDigest: digest } })).catch((e) => ({ error: errorMessage(e) })) : Promise.resolve(null),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [repoRes, imgs, lifecycle, policy, findings] = data;
  const repo = repoRes.repositories![0];
  const base = `/ecr/repositories/${encodeURIComponent(name)}`;
  const hidden = <input type="hidden" name="repo" value={name} />;
  const host = repo.repositoryUri?.split("/")[0];
  return (
    <Page wide>
      <Header variant="h1" actions={<ConfirmAction values={[name]} extra={{ from: "detail" }} action={deleteRepositories} label="Delete" title="Delete repository" noun="repository" confirmWord="delete" />}>
        {name}
      </Header>
      <Container header={<Header>Push commands</Header>}>
        <p className="mb-2 text-sm text-muted">The emulator serves the ECR API; whether it also accepts <code className="font-mono">docker push</code> depends on the build. Standard commands for reference:</p>
        <pre className="overflow-auto rounded-lg bg-[#f6f6f5] p-3 font-mono text-[13px]">{`aws ecr get-login-password | docker login --username AWS --password-stdin ${host}
docker tag my-image:latest ${repo.repositoryUri}:latest
docker push ${repo.repositoryUri}:latest`}</pre>
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "images", label: "Images" }, { id: "lifecycle", label: "Lifecycle policy" }, { id: "permissions", label: "Permissions" }, { id: "settings", label: "Repository settings" }]} />
      {tab === "images" && (
        <>
          <Container
            noPadding
            header={
              <div className="space-y-3">
                <Header counter={imgs.imageDetails?.length ?? 0} actions={<><LinkButton href={base} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton><ConfirmAction formId="img-form" action={deleteImages} extra={{ repo: name }} label="Delete" title="Delete images" noun="image" confirmWord="delete" /></>}>
                  Images
                </Header>
                <TableFilter tableId="img-table" placeholder="Search artifacts" />
              </div>
            }
          >
            <form id="img-form" />
            <Table
              id="img-table"
              formId="img-form"
              selection="multi"
              rows={imgs.imageDetails ?? []}
              rowKey={(i) => i.imageDigest!}
              filterText={(i) => `${(i.imageTags ?? []).join(" ")} ${i.imageDigest}`}
              columns={[
                { header: "Image tags", cell: (i) => (i.imageTags?.length ? <span className="flex flex-wrap gap-1">{i.imageTags.map((t) => <Badge key={t}>{t}</Badge>)}</span> : <i className="text-muted">untagged</i>) },
                { header: "Pushed at", cell: (i) => formatDate(i.imagePushedAt) },
                { header: "Size", cell: (i) => formatBytes(i.imageSizeInBytes), sortValue: (i) => i.imageSizeInBytes ?? 0 },
                { header: "Digest", cell: (i) => <span className="font-mono text-xs break-all">{i.imageDigest}</span> },
                { header: "Scan status", cell: (i) => (
                  <span className="flex items-center gap-2">
                    {i.imageScanStatus?.status ?? "-"}
                    <a className="text-accent hover:underline" href={`${base}?digest=${encodeURIComponent(i.imageDigest!)}`}>Findings</a>
                    <form action={scanImage}>{hidden}<input type="hidden" name="digest" value={i.imageDigest} /><button className="text-accent hover:underline">Scan</button></form>
                  </span>
                ) },
              ]}
              empty={<EmptyState title="No images" description="Push an image to this repository to see it here." />}
            />
          </Container>
          {findings && (
            <Container header={<Header description={<Code>{digest}</Code>}>Scan findings</Header>}>
              {"error" in findings ? (
                <ErrorAlert message={String(findings.error)} />
              ) : (
                <KeyValue items={[
                  { label: "Scan status", value: findings.imageScanStatus?.status ?? "-" },
                  { label: "Completed", value: formatDate(findings.imageScanFindings?.imageScanCompletedAt) },
                  { label: "Severity counts", value: Object.entries(findings.imageScanFindings?.findingSeverityCounts ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "None" },
                ]} />
              )}
            </Container>
          )}
        </>
      )}
      {(tab === "lifecycle" || tab === "permissions") && (
        <Container header={<Header description={tab === "lifecycle" ? "Rules that expire images automatically. Empty and save to delete the policy." : "Repository policy JSON (stored, not enforced by the emulator). Empty and save to delete it."}>{tab === "lifecycle" ? "Lifecycle policy" : "Repository policy"}</Header>}>
          <form action={savePolicy} className="space-y-3">
            {hidden}
            <input type="hidden" name="kind" value={tab === "lifecycle" ? "lifecycle" : "repository"} />
            {tab === "lifecycle" && !lifecycle.lifecyclePolicyText && <Alert>No lifecycle policy. A sample rule is filled in below.</Alert>}
            <Textarea name="policy" rows={16} spellCheck={false} defaultValue={tab === "lifecycle" ? pretty(lifecycle.lifecyclePolicyText) || LIFECYCLE_SAMPLE : pretty(policy.policyText)} />
            <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
          </form>
        </Container>
      )}
      {tab === "settings" && (
        <Container header={<Header>General settings</Header>}>
          <form action={saveSettings} className="space-y-5">
            {hidden}
            <KeyValue items={[
              { label: "URI", value: <span className="font-mono text-[13px] break-all">{repo.repositoryUri}</span> },
              { label: "ARN", value: <span className="font-mono text-[13px] break-all">{repo.repositoryArn}</span> },
              { label: "Encryption", value: repo.encryptionConfiguration?.encryptionType ?? "AES256" },
            ]} />
            <FormField label="Image tag mutability">
              <Select name="mutability" defaultValue={repo.imageTagMutability}><option value="MUTABLE">Mutable</option><option value="IMMUTABLE">Immutable</option></Select>
            </FormField>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="scanOnPush" defaultChecked={repo.imageScanningConfiguration?.scanOnPush} className="accent-accent" /> Scan on push</label>
            <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
          </form>
        </Container>
      )}
    </Page>
  );
}
