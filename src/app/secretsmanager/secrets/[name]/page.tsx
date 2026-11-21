import { DescribeSecretCommand, GetResourcePolicyCommand, ListSecretVersionIdsCommand } from "@aws-sdk/client-secrets-manager";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TagsPanel } from "@/components/tags";
import { ModalButton } from "@/components/client/modal";
import { KeyValueEditor } from "@/components/client/kv-editor";
import { Alert, Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { putSecretValue, restoreSecret, rotateSecret, savePolicy, tagSecret, untagSecret, updateSecret } from "../../actions";
import { RevealSecret } from "../../reveal";

export default async function SecretPage({ params, searchParams }: PageProps<"/secretsmanager/secrets/[name]">) {
  const name = decodeURIComponent((await params).name);
  const tab = String((await searchParams).tab ?? "overview");
  const { secrets } = await aws();
  let data;
  try {
    data = await Promise.all([
      secrets.send(new DescribeSecretCommand({ SecretId: name })),
      secrets.send(new ListSecretVersionIdsCommand({ SecretId: name, IncludeDeprecated: true })).catch(() => ({ Versions: [] })),
      secrets.send(new GetResourcePolicyCommand({ SecretId: name })).catch(() => ({ ResourcePolicy: undefined })),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [d, versions, policy] = data;
  const hidden = <input type="hidden" name="name" value={name} />;
  const base = `/secretsmanager/secrets/${encodeURIComponent(name)}`;
  let prettyPolicy = policy.ResourcePolicy ?? "";
  try {
    if (prettyPolicy) prettyPolicy = JSON.stringify(JSON.parse(prettyPolicy), null, 2);
  } catch {}

  return (
    <Page>
      <Header variant="h1" info>{name}</Header>
      {d.DeletedDate && (
        <Alert type="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>This secret is scheduled for deletion on {formatDate(d.DeletedDate)}.</span>
            <form action={restoreSecret}>
              {hidden}
              <button className={buttonClass("normal")}>Cancel deletion</button>
            </form>
          </div>
        </Alert>
      )}
      <Container
        header={
          <Header
            actions={
              <ModalButton label="Edit" title="Edit secret">
                <form action={updateSecret} className="space-y-4">
                  {hidden}
                  <FormField label="Description"><Input name="description" defaultValue={d.Description ?? ""} /></FormField>
                  <FormField label="Encryption key"><Input name="kmsKeyId" defaultValue={d.KmsKeyId ?? ""} placeholder="aws/secretsmanager" /></FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                </form>
              </ModalButton>
            }
          >
            Secret details
          </Header>
        }
      >
        <KeyValue
          items={[
            { label: "Encryption key", value: d.KmsKeyId ?? "aws/secretsmanager" },
            { label: "Secret name", value: d.Name },
            { label: "Secret ARN", value: <span className="font-mono text-[13px] break-all">{d.ARN}</span> },
            { label: "Secret description", value: d.Description || "-" },
            { label: "Last modified", value: formatDate(d.LastChangedDate) },
            { label: "Last retrieved", value: formatDate(d.LastAccessedDate) },
          ]}
        />
      </Container>
      <Tabs
        base={base}
        active={tab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "rotation", label: "Rotation" },
          { id: "versions", label: "Versions" },
          { id: "tags", label: "Tags" },
        ]}
      />
      {tab === "overview" && (
        <>
          <Container
            header={
              <Header
                description="Retrieve and view the secret value."
                actions={
                  <ModalButton label="Edit" title="Edit secret value" size="lg">
                    <form action={putSecretValue} className="space-y-4">
                      {hidden}
                      <p className="text-sm text-muted">Saving creates a new version labelled AWSCURRENT; the previous one becomes AWSPREVIOUS.</p>
                      <KeyValueEditor name="value" />
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                    </form>
                  </ModalButton>
                }
              >
                Secret value
              </Header>
            }
          >
            <RevealSecret name={name} />
          </Container>
          <Container header={<Header description="Add or edit a resource policy to allow access to this secret from other principals. The emulator does not enforce it.">Resource permissions</Header>}>
            <form action={savePolicy} className="space-y-3">
              {hidden}
              <Textarea name="policy" rows={10} defaultValue={prettyPolicy} placeholder='{"Version": "2012-10-17", "Statement": [...]}' spellCheck={false} />
              <div className="flex justify-end"><button className={buttonClass("normal")}>{prettyPolicy ? "Save" : "Save permissions"}</button></div>
            </form>
          </Container>
        </>
      )}
      {tab === "rotation" && (
        <Container header={<Header>Rotation configuration</Header>}>
          <KeyValue
            items={[
              { label: "Rotation status", value: d.RotationEnabled ? <StatusIndicator type="success">Enabled</StatusIndicator> : <StatusIndicator type="stopped">Disabled</StatusIndicator> },
              { label: "Rotation schedule", value: d.RotationRules?.ScheduleExpression ?? (d.RotationRules?.AutomaticallyAfterDays ? `Every ${d.RotationRules.AutomaticallyAfterDays} days` : "-") },
              { label: "Lambda rotation function", value: d.RotationLambdaARN ?? "-" },
              { label: "Last rotated", value: formatDate(d.LastRotatedDate) },
              { label: "Next rotation", value: formatDate(d.NextRotationDate) },
            ]}
          />
          <form action={rotateSecret} className="mt-6 space-y-4 border-t border-line pt-4">
            {hidden}
            <FormField label="Rotation function ARN" description="Lambda function that rotates the secret. The emulator runs it locally.">
              <Input name="lambda" defaultValue={d.RotationLambdaARN ?? ""} placeholder="arn:aws:lambda:us-east-1:000000000000:function:rotate" />
            </FormField>
            <FormField label="Rotate every (days)"><Input name="days" type="number" min={1} max={1000} defaultValue={d.RotationRules?.AutomaticallyAfterDays ?? 30} /></FormField>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="now" className="accent-accent" /> Rotate immediately</label>
            <div className="flex justify-end"><button className={buttonClass("primary")}>Save rotation</button></div>
          </form>
        </Container>
      )}
      {tab === "versions" && (
        <Container noPadding header={<Header counter={versions.Versions?.length ?? 0}>Versions</Header>}>
          <Table
            rows={versions.Versions ?? []}
            rowKey={(v) => v.VersionId!}
            columns={[
              { header: "Version ID", cell: (v) => <span className="font-mono text-[13px]">{v.VersionId}</span> },
              { header: "Staging labels", cell: (v) => <span className="flex flex-wrap gap-1">{(v.VersionStages ?? []).map((s) => <Badge key={s} color={s === "AWSCURRENT" ? "blue" : "grey"}>{s}</Badge>)}</span> },
              { header: "Created", cell: (v) => formatDate(v.CreatedDate) },
              { header: "Value", sortable: false, cell: (v) => <RevealSecret name={name} versionId={v.VersionId} label="Retrieve" /> },
            ]}
            empty={<EmptyState title="No versions" />}
          />
        </Container>
      )}
      {tab === "tags" && <TagsPanel tags={d.Tags ?? []} addAction={tagSecret} removeAction={untagSecret} hidden={{ name }} />}
    </Page>
  );
}
