import {
  GetRoleCommand,
  GetRolePolicyCommand,
  ListAttachedRolePoliciesCommand,
  ListInstanceProfilesForRoleCommand,
  ListRolePoliciesCommand,
  ListRoleTagsCommand,
  type InstanceProfile,
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
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Textarea, buttonClass } from "@/components/ui";
import { createInstanceProfileForRole, deleteInstanceProfiles, editRole, tagIam, untagIam, updateTrustPolicy } from "../../actions";
import { AttachedPolicies } from "../../attached-policies";
import { InlinePolicies } from "../../inline-policies";
import { PermissionsBoundary } from "../../boundary";
import { allPolicies, decodeDoc } from "../../policy-options";

const TABS = [
  { id: "permissions", label: "Permissions" },
  { id: "trust", label: "Trust relationships" },
  { id: "tags", label: "Tags" },
  { id: "instance-profiles", label: "Instance profiles" },
];

export default async function RolePage({ params, searchParams }: PageProps<"/iam/roles/[name]">) {
  const name = decodeURIComponent((await params).name);
  const t = String((await searchParams).tab ?? "permissions");
  const tab = TABS.some((x) => x.id === t) ? t : "permissions";
  const { iam } = await aws();
  let role;
  try {
    role = (await iam.send(new GetRoleCommand({ RoleName: name }))).Role!;
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const trust = decodeDoc(role.AssumeRolePolicyDocument);
  const d = {
    attached: [] as { PolicyArn?: string; PolicyName?: string }[],
    inline: [] as { name: string; doc: string }[],
    options: [] as Awaited<ReturnType<typeof allPolicies>>,
    tags: [] as Tag[],
    profiles: [] as InstanceProfile[],
  };
  let tabError: string | null = null;
  try {
    if (tab === "permissions") {
      const [att, names, options] = await Promise.all([
        iam.send(new ListAttachedRolePoliciesCommand({ RoleName: name })),
        iam.send(new ListRolePoliciesCommand({ RoleName: name })),
        allPolicies(iam),
      ]);
      d.attached = att.AttachedPolicies ?? [];
      d.options = options;
      d.inline = await Promise.all((names.PolicyNames ?? []).map(async (p) => ({ name: p, doc: decodeDoc((await iam.send(new GetRolePolicyCommand({ RoleName: name, PolicyName: p }))).PolicyDocument) })));
    } else if (tab === "tags") {
      d.tags = (await iam.send(new ListRoleTagsCommand({ RoleName: name }))).Tags ?? [];
    } else if (tab === "instance-profiles") {
      d.profiles = (await iam.send(new ListInstanceProfilesForRoleCommand({ RoleName: name }))).InstanceProfiles ?? [];
    }
  } catch (e) {
    tabError = errorMessage(e);
  }
  const base = `/iam/roles/${encodeURIComponent(name)}`;
  const roleField = <input type="hidden" name="role" value={name} />;
  const serviceLinked = role.Path?.startsWith("/aws-service-role/");

  let body: React.ReactNode = null;
  if (tab === "permissions") {
    body = (
      <>
        <AttachedPolicies kind="role" principal={name} policies={d.attached} options={d.options} />
        <InlinePolicies kind="role" principal={name} policies={d.inline} />
        <PermissionsBoundary kind="role" principal={name} arn={role.PermissionsBoundary?.PermissionsBoundaryArn} options={d.options} />
      </>
    );
  } else if (tab === "trust") {
    body = (
      <Container
        header={
          <Header
            description="Entities that can assume this role."
            actions={
              <ModalButton label="Edit trust policy" title="Edit trust policy" size="lg">
                <form action={updateTrustPolicy} className="space-y-4">
                  {roleField}
                  <FormField label="Trust policy (JSON)">
                    <Textarea name="document" rows={16} spellCheck={false} defaultValue={trust} />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Update policy</button></div>
                </form>
              </ModalButton>
            }
          >
            Trusted entities
          </Header>
        }
      >
        <pre className="overflow-auto rounded-lg bg-code p-3 font-mono text-[13px]">{trust}</pre>
      </Container>
    );
  } else if (tab === "tags") {
    body = <TagsPanel tags={d.tags} addAction={tagIam} removeAction={untagIam} hidden={{ kind: "role", id: name }} />;
  } else {
    body = (
      <Container
        noPadding
        header={
          <Header
            counter={d.profiles.length}
            description="An instance profile passes this role to an EC2 instance."
            actions={
              <>
                <ConfirmAction formId="ip-form" action={deleteInstanceProfiles} extra={{ role: name }} label="Delete" title="Delete instance profile" noun="instance profile" />
                <ModalButton label="Create instance profile" title="Create instance profile" variant="primary">
                  <form action={createInstanceProfileForRole} className="space-y-4">
                    {roleField}
                    <FormField label="Instance profile name">
                      <Input name="profile" defaultValue={name} required pattern="[\w+=,.@\-]+" />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create instance profile</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Instance profiles
          </Header>
        }
      >
        <form id="ip-form" />
        <Table
          formId="ip-form"
          selection="multi"
          rows={d.profiles}
          rowKey={(p) => p.InstanceProfileName!}
          columns={[
            { header: "Name", cell: (p) => p.InstanceProfileName },
            { header: "ARN", cell: (p) => <span className="font-mono text-[13px] break-all">{p.Arn}</span> },
            { header: "Created", cell: (p) => formatDate(p.CreateDate) },
          ]}
          empty={<EmptyState title="No instance profiles" />}
        />
      </Container>
    );
  }

  return (
    <Page>
      <Header
        variant="h1"
        info
        actions={
          <ModalButton label="Edit" title={`Edit ${name}`}>
            <form action={editRole} className="space-y-4">
              {roleField}
              <FormField label="Description">
                <Textarea name="description" rows={3} maxLength={1000} defaultValue={role.Description ?? ""} className="font-sans" />
              </FormField>
              <FormField label="Maximum session duration (hours)" constraint="1 to 12 hours.">
                <Input name="maxSession" type="number" min={1} max={12} defaultValue={String((role.MaxSessionDuration ?? 3600) / 3600)} />
              </FormField>
              <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
            </form>
          </ModalButton>
        }
      >
        {name}
      </Header>
      <Container header={<Header>Summary</Header>}>
        <KeyValue
          items={[
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{role.Arn}</span> },
            { label: "Creation date", value: formatDate(role.CreateDate) },
            { label: "Description", value: role.Description || "-" },
            { label: "Maximum session duration", value: `${(role.MaxSessionDuration ?? 3600) / 3600} hour(s)` },
            { label: "Last activity", value: role.RoleLastUsed?.LastUsedDate ? formatDate(role.RoleLastUsed.LastUsedDate) : "-" },
            { label: "Type", value: serviceLinked ? "Service-linked role" : "Role" },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={TABS} />
      {tabError ? <ErrorAlert message={tabError} /> : body}
    </Page>
  );
}
