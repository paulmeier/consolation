import Link from "next/link";
import {
  GetPolicyCommand,
  GetPolicyVersionCommand,
  ListEntitiesForPolicyCommand,
  ListPolicyTagsCommand,
  ListPolicyVersionsCommand,
  type PolicyVersion,
  type Tag,
} from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Table } from "@/components/table";
import { TagsPanel } from "@/components/tags";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Badge, Container, EmptyState, ErrorAlert, FormField, Header, KeyValue, Textarea, buttonClass } from "@/components/ui";
import { createPolicyVersion, deletePolicies, deletePolicyVersions, setDefaultPolicyVersion, tagIam, untagIam } from "../../actions";
import { decodeDoc } from "../../policy-options";

const TABS = [
  { id: "permissions", label: "Permissions" },
  { id: "entities", label: "Entities attached" },
  { id: "versions", label: "Policy versions" },
  { id: "tags", label: "Tags" },
];

export default async function PolicyPage({ params, searchParams }: PageProps<"/iam/policies/[arn]">) {
  const arn = decodeURIComponent((await params).arn);
  const t = String((await searchParams).tab ?? "permissions");
  const tab = TABS.some((x) => x.id === t) ? t : "permissions";
  const awsManaged = arn.startsWith("arn:aws:iam::aws:");
  const { iam } = await aws();
  let policy, doc, versions: PolicyVersion[], entities, tags: Tag[] = [];
  try {
    policy = (await iam.send(new GetPolicyCommand({ PolicyArn: arn }))).Policy!;
    [doc, versions, entities] = await Promise.all([
      iam.send(new GetPolicyVersionCommand({ PolicyArn: arn, VersionId: policy.DefaultVersionId! })).then((r) => decodeDoc(r.PolicyVersion?.Document)),
      iam.send(new ListPolicyVersionsCommand({ PolicyArn: arn })).then((r) => r.Versions ?? []),
      iam.send(new ListEntitiesForPolicyCommand({ PolicyArn: arn })),
    ]);
    if (tab === "tags" && !awsManaged) tags = (await iam.send(new ListPolicyTagsCommand({ PolicyArn: arn }))).Tags ?? [];
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{arn.split("/").pop()}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const attached = [
    ...(entities.PolicyUsers ?? []).map((u) => ({ name: u.UserName!, type: "User", href: `/iam/users/${encodeURIComponent(u.UserName!)}` })),
    ...(entities.PolicyGroups ?? []).map((g) => ({ name: g.GroupName!, type: "Group", href: `/iam/groups/${encodeURIComponent(g.GroupName!)}` })),
    ...(entities.PolicyRoles ?? []).map((r) => ({ name: r.RoleName!, type: "Role", href: `/iam/roles/${encodeURIComponent(r.RoleName!)}` })),
  ];
  const base = `/iam/policies/${encodeURIComponent(arn)}`;
  const arnField = <input type="hidden" name="arn" value={arn} />;
  const visibleTabs = awsManaged ? TABS.filter((x) => x.id !== "tags") : TABS;

  let body: React.ReactNode = null;
  if (tab === "permissions") {
    body = (
      <Container
        header={
          <Header
            description={`Policy version ${policy.DefaultVersionId} (default).`}
            actions={
              !awsManaged && (
                <ModalButton label="Edit" title={`Edit ${policy.PolicyName}`} size="lg">
                  <form action={createPolicyVersion} className="space-y-4">
                    {arnField}
                    <p className="text-sm text-muted">Saving creates a new version and sets it as the default. IAM keeps up to five versions; the oldest non-default version is removed when needed.</p>
                    <FormField label="Policy editor (JSON)">
                      <Textarea name="document" rows={18} spellCheck={false} defaultValue={doc} />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                  </form>
                </ModalButton>
              )
            }
          >
            Permissions defined in this policy
          </Header>
        }
      >
        <pre className="max-h-[560px] overflow-auto rounded-lg bg-code p-3 font-mono text-[13px]">{doc}</pre>
      </Container>
    );
  } else if (tab === "entities") {
    body = (
      <Container noPadding header={<Header counter={attached.length} description="Users, groups and roles this policy is attached to.">Entities attached</Header>}>
        <Table
          rows={attached}
          rowKey={(e) => `${e.type}:${e.name}`}
          columns={[
            { header: "Entity name", cell: (e) => <Link className="text-accent hover:underline" href={e.href}>{e.name}</Link> },
            { header: "Entity type", cell: (e) => e.type },
          ]}
          empty={<EmptyState title="Not attached" description="No users, groups or roles use this policy." />}
        />
      </Container>
    );
  } else if (tab === "versions") {
    body = (
      <Container
        noPadding
        header={
          <Header
            counter={versions.length}
            description="The default version is the one in effect."
            actions={
              !awsManaged && (
                <>
                  <ConfirmAction formId="versions-form" action={deletePolicyVersions} extra={{ arn }} label="Delete" title="Delete policy version" noun="version" />
                  <button form="versions-form" className={`${buttonClass("normal")} needs-selection`}>Set as default</button>
                </>
              )
            }
          >
            Policy versions
          </Header>
        }
      >
        <form id="versions-form" action={setDefaultPolicyVersion}>{arnField}</form>
        <Table
          formId="versions-form"
          selection={awsManaged ? undefined : "single"}
          rows={[...versions].sort((a, b) => +(b.CreateDate ?? 0) - +(a.CreateDate ?? 0))}
          rowKey={(v) => v.VersionId!}
          columns={[
            { header: "Version", cell: (v) => <>{v.VersionId} {v.IsDefaultVersion && <Badge color="blue">Default</Badge>}</> },
            { header: "Created", cell: (v) => formatDate(v.CreateDate) },
          ]}
        />
      </Container>
    );
  } else {
    body = <TagsPanel tags={tags} addAction={tagIam} removeAction={untagIam} hidden={{ kind: "policy", id: arn }} />;
  }

  return (
    <Page>
      <Header variant="h1" info actions={!awsManaged && <ConfirmAction action={deletePolicies} values={[arn]} extra={{ redirect: "1" }} label="Delete" title="Delete policy" noun="policy" />}>
        {policy.PolicyName}
      </Header>
      <Container header={<Header>Policy details</Header>}>
        <KeyValue
          items={[
            { label: "Type", value: awsManaged ? "AWS managed" : "Customer managed" },
            { label: "Creation time", value: formatDate(policy.CreateDate) },
            { label: "Edited time", value: formatDate(policy.UpdateDate) },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{arn}</span> },
            { label: "Description", value: policy.Description || "-" },
            { label: "Attachments", value: String(policy.AttachmentCount ?? attached.length) },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={visibleTabs} />
      {body}
    </Page>
  );
}
