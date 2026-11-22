import Link from "next/link";
import { GetGroupCommand, GetGroupPolicyCommand, ListAttachedGroupPoliciesCommand, ListGroupPoliciesCommand, ListUsersCommand } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, Header, KeyValue, buttonClass } from "@/components/ui";
import { addUsersToGroup, deleteGroups, removeUsersFromGroup } from "../../actions";
import { AttachedPolicies } from "../../attached-policies";
import { InlinePolicies } from "../../inline-policies";
import { allPolicies, decodeDoc } from "../../policy-options";

export default async function GroupPage({ params, searchParams }: PageProps<"/iam/groups/[name]">) {
  const name = decodeURIComponent((await params).name);
  const tab = (await searchParams).tab === "permissions" ? "permissions" : "users";
  let data;
  try {
    const { iam } = await aws();
    const [group, attached, inlineNames, allUsers, options] = await Promise.all([
      iam.send(new GetGroupCommand({ GroupName: name })),
      iam.send(new ListAttachedGroupPoliciesCommand({ GroupName: name })),
      iam.send(new ListGroupPoliciesCommand({ GroupName: name })),
      iam.send(new ListUsersCommand({ MaxItems: 1000 })),
      allPolicies(iam),
    ]);
    const inline = await Promise.all(
      (inlineNames.PolicyNames ?? []).map(async (p) => ({ name: p, doc: decodeDoc((await iam.send(new GetGroupPolicyCommand({ GroupName: name, PolicyName: p }))).PolicyDocument) })),
    );
    data = { group, attached, inline, allUsers, options };
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const g = data.group.Group!;
  const members = data.group.Users ?? [];
  const nonMembers = (data.allUsers.Users ?? []).filter((u) => !members.some((m) => m.UserName === u.UserName));
  const base = `/iam/groups/${encodeURIComponent(name)}`;
  return (
    <Page>
      <Header variant="h1" info actions={<ConfirmAction action={deleteGroups} values={[name]} extra={{ redirect: "1" }} label="Delete" title="Delete user group" noun="user group" />}>
        {name}
      </Header>
      <Container header={<Header>Summary</Header>}>
        <KeyValue
          items={[
            { label: "User group name", value: name },
            { label: "Creation time", value: formatDate(g.CreateDate) },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{g.Arn}</span> },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "users", label: `Users (${members.length})` }, { id: "permissions", label: "Permissions" }]} />
      {tab === "users" ? (
        <Container
          noPadding
          header={
            <Header
              counter={members.length}
              description="An IAM user in this user group is subject to the permissions defined for the group."
              actions={
                <>
                  <ConfirmAction formId="members-form" action={removeUsersFromGroup} extra={{ group: name }} label="Remove users" title="Remove users from group" noun="user" confirmWord="remove" confirmLabel="Remove" />
                  <ModalButton label="Add users" title={`Add users to ${name}`} variant="primary">
                    <form action={addUsersToGroup} className="space-y-4">
                      <input type="hidden" name="group" value={name} />
                      {nonMembers.length === 0 ? (
                        <p className="text-muted">All users are already in this group.</p>
                      ) : (
                        <fieldset className="max-h-72 space-y-1 overflow-auto">
                          {nonMembers.map((u) => (
                            <label key={u.UserName} className="flex items-center gap-2">
                              <input type="checkbox" name="users" value={u.UserName} className="accent-accent" /> {u.UserName}
                            </label>
                          ))}
                        </fieldset>
                      )}
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={nonMembers.length === 0}>Add users</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Users in this group
            </Header>
          }
        >
          <form id="members-form" />
          <Table
            formId="members-form"
            selection="multi"
            rows={members}
            rowKey={(u) => u.UserName!}
            columns={[
              { header: "User name", cell: (u) => <Link className="text-accent hover:underline" href={`/iam/users/${encodeURIComponent(u.UserName!)}`}>{u.UserName}</Link> },
              { header: "Creation time", cell: (u) => formatDate(u.CreateDate) },
            ]}
            empty={<EmptyState title="No users" description="Add users to give them this group's permissions." />}
          />
        </Container>
      ) : (
        <>
          <AttachedPolicies kind="group" principal={name} policies={data.attached.AttachedPolicies ?? []} options={data.options} />
          <InlinePolicies kind="group" principal={name} policies={data.inline} />
        </>
      )}
    </Page>
  );
}
