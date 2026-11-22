import Link from "next/link";
import { GetGroupCommand, ListAttachedGroupPoliciesCommand, ListGroupsCommand } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createGroup, deleteGroups } from "../actions";
import { allPolicies } from "../policy-options";
import { PolicyDatalist } from "../attached-policies";

export const metadata = { title: "User groups | IAM" };
const FORM = "groups-form";

export default async function GroupsPage() {
  let rows: { name: string; arn: string; created?: Date; users: number; policies: number }[] = [];
  let options: Awaited<ReturnType<typeof allPolicies>> = [];
  let error: string | null = null;
  try {
    const { iam } = await aws();
    const groups = (await iam.send(new ListGroupsCommand({ MaxItems: 1000 }))).Groups ?? [];
    options = await allPolicies(iam);
    rows = await Promise.all(
      groups.map(async (g) => {
        const [members, pols] = await Promise.all([
          iam.send(new GetGroupCommand({ GroupName: g.GroupName! })),
          iam.send(new ListAttachedGroupPoliciesCommand({ GroupName: g.GroupName! })),
        ]);
        return { name: g.GroupName!, arn: g.Arn!, created: g.CreateDate, users: members.Users?.length ?? 0, policies: pols.AttachedPolicies?.length ?? 0 };
      }),
    );
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              variant="h1"
              counter={rows.length}
              info
              description="A user group is a collection of IAM users. Policies attached to a group apply to all its users."
              actions={
                <>
                  <LinkButton href="/iam/groups" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId={FORM} action={deleteGroups} label="Delete" title="Delete user groups" noun="user group" description="Deleting a group removes its members and policies first." />
                  <ModalButton label="Create group" title="Create user group" variant="primary">
                    <form action={createGroup} className="space-y-4">
                      <FormField label="User group name" constraint="Up to 128 letters, numbers and +=,.@-_ characters.">
                        <Input name="name" required maxLength={128} pattern="[\w+=,.@\-]+" autoFocus />
                      </FormField>
                      <FormField label={<>Attach permissions policy <i className="font-normal text-muted">- optional</i></>}>
                        <Input name="policies" list="group-create-options" placeholder="arn:aws:iam::aws:policy/ReadOnlyAccess" />
                      </FormField>
                      <PolicyDatalist id="group-create-options" options={options} />
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create user group</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              User groups
            </Header>
            <TableFilter tableId="groups-table" placeholder="Filter by group name" />
          </div>
        }
      >
        <form id={FORM} />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="groups-table"
          formId={FORM}
          selection="multi"
          rows={rows}
          rowKey={(g) => g.name}
          filterText={(g) => g.name}
          columns={[
            { header: "Group name", cell: (g) => <Link className="text-accent hover:underline" href={`/iam/groups/${encodeURIComponent(g.name)}`}>{g.name}</Link> },
            { header: "Users", cell: (g) => g.users },
            { header: "Permissions", cell: (g) => (g.policies ? `${g.policies} attached` : "Not defined") },
            { header: "Creation time", cell: (g) => formatDate(g.created) },
          ]}
          empty={<EmptyState title="No user groups" description="Create a group to manage permissions for several users at once." />}
        />
      </Container>
    </Page>
  );
}
