import Link from "next/link";
import { Suspense } from "react";
import { ListUsersCommand, type User } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createUser, deleteUsers } from "../actions";

export const metadata = { title: "Users | IAM" };
const FORM = "users-form";

async function Users() {
  let users: User[] = [];
  let error: string | null = null;
  try {
    const { iam } = await aws();
    users = (await iam.send(new ListUsersCommand({ MaxItems: 1000 }))).Users ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={users.length}
            info
            description="An IAM user is an identity with long-term credentials that is used to interact with AWS in an account."
            actions={
              <>
                <LinkButton href="/iam/users" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteUsers} label="Delete" title="Delete user" noun="user" confirmWord="confirm" description="Deleting a user also deletes its access keys and detaches its managed policies." />
                <ModalButton label="Create user" title="Create user" variant="primary">
                  <form action={createUser} className="space-y-4">
                    <FormField label="User name" constraint="The user name can have up to 64 characters. Valid characters: A-Z, a-z, 0-9, and + = , . @ _ - (hyphen)">
                      <Input name="name" required maxLength={64} pattern="[\w+=,.@\-]+" autoFocus />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create user</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Users
          </Header>
          <TableFilter tableId="users-table" placeholder="Search" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="users-table"
        formId={FORM}
        selection="multi"
        rows={users}
        rowKey={(u) => u.UserName!}
        filterText={(u) => u.UserName!}
        columns={[
          { header: "User name", cell: (u) => <Link className="underline-link" href={`/iam/users/${encodeURIComponent(u.UserName!)}`}>{u.UserName}</Link> },
          { header: "Path", cell: (u) => u.Path },
          { header: "ARN", cell: (u) => <span className="font-mono text-[13px]">{u.Arn}</span> },
          { header: "Creation time", cell: (u) => formatDate(u.CreateDate) },
        ]}
        empty={<EmptyState title="No resources to display" />}
      />
    </Container>
  );
}

export default function UsersPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Users</Header>}>Loading users…</Container>}>
        <Users />
      </Suspense>
    </Page>
  );
}
