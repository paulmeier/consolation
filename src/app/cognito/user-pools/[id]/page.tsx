import {
  AdminListGroupsForUserCommand,
  DescribeUserPoolCommand,
  ListGroupsCommand,
  ListUserPoolClientsCommand,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, StatusIndicator, buttonClass } from "@/components/ui";
import { addToGroup, createClient, createGroup, createUser, deleteClients, deleteGroups, deleteUserPools, removeFromGroup, setDomain, userAction } from "../../actions";

const attr = (u: UserType, n: string) => u.Attributes?.find((a) => a.Name === n)?.Value;

function userStatus(s?: string) {
  if (s === "CONFIRMED") return <StatusIndicator type="success">Confirmed</StatusIndicator>;
  if (s === "FORCE_CHANGE_PASSWORD") return <StatusIndicator type="warning">Force change password</StatusIndicator>;
  if (s === "RESET_REQUIRED") return <StatusIndicator type="warning">Reset required</StatusIndicator>;
  if (s === "UNCONFIRMED") return <StatusIndicator type="pending">Unconfirmed</StatusIndicator>;
  return s ?? "-";
}

export default async function PoolPage({ params, searchParams }: PageProps<"/cognito/user-pools/[id]">) {
  const id = (await params).id;
  const tab = String((await searchParams).tab ?? "users");
  const { cognito } = await aws();
  let data;
  try {
    data = await Promise.all([
      cognito.send(new DescribeUserPoolCommand({ UserPoolId: id })),
      cognito.send(new ListUsersCommand({ UserPoolId: id, Limit: 60 })).catch(() => ({ Users: [] as UserType[] })),
      cognito.send(new ListGroupsCommand({ UserPoolId: id, Limit: 60 })).catch(() => ({ Groups: [] })),
      cognito.send(new ListUserPoolClientsCommand({ UserPoolId: id, MaxResults: 60 })).catch(() => ({ UserPoolClients: [] })),
    ]);
  } catch (e) {
    return (<Page><Header variant="h1">{id}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const [desc, usersRes, groupsRes, clientsRes] = data;
  const pool = desc.UserPool!;
  const users = usersRes.Users ?? [];
  const groups = groupsRes.Groups ?? [];
  const memberships = tab === "groups" ? await Promise.all(users.map(async (u) => ({ user: u.Username!, groups: ((await cognito.send(new AdminListGroupsForUserCommand({ UserPoolId: id, Username: u.Username! })).catch(() => ({ Groups: [] }))).Groups ?? []).map((g) => g.GroupName!) }))) : [];
  const base = `/cognito/user-pools/${id}`;
  const hidden = <input type="hidden" name="pool" value={id} />;
  const emailLogin = pool.UsernameAttributes?.includes("email");
  return (
    <Page wide>
      <Header variant="h1" info actions={<ConfirmAction values={[id]} extra={{ from: "detail" }} action={deleteUserPools} label="Delete user pool" title="Delete user pool" noun="user pool" confirmWord="delete" />}>
        {pool.Name}
      </Header>
      <Container header={<Header>User pool overview</Header>}>
        <KeyValue
          columns={4}
          items={[
            { label: "User pool ID", value: <span className="font-mono text-[13px]">{id}</span> },
            { label: "ARN", value: <span className="font-mono text-xs break-all">{pool.Arn}</span> },
            { label: "Estimated number of users", value: pool.EstimatedNumberOfUsers ?? users.length },
            { label: "Sign-in identifiers", value: emailLogin ? "Email" : "Username" },
            { label: "Created time", value: formatDate(pool.CreationDate) },
            { label: "Last updated", value: formatDate(pool.LastModifiedDate) },
            { label: "Deletion protection", value: pool.DeletionProtection === "ACTIVE" ? "Active" : "Inactive" },
            { label: "Domain", value: pool.Domain ? <span className="font-mono text-xs">{pool.Domain}</span> : "-" },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "users", label: "Users" }, { id: "groups", label: "Groups" }, { id: "clients", label: "App clients" }, { id: "domain", label: "Domain" }]} />
      {tab === "users" && (
        <Container
          noPadding
          header={
            <div className="space-y-3">
              <Header
                counter={users.length}
                description="Users created here have a suppressed invitation message. Use test values only."
                actions={
                  <>
                    {(["enable", "disable", "confirm", "reset password"] as const).map((op) => (
                      <ConfirmAction key={op} formId="users-form" action={userAction} extra={{ pool: id, op }} label={op === "confirm" ? "Confirm account" : op[0].toUpperCase() + op.slice(1)} title={`${op[0].toUpperCase()}${op.slice(1)} users`} noun="user" confirmWord={op.split(" ")[0]} confirmLabel={op[0].toUpperCase() + op.slice(1)} />
                    ))}
                    <ConfirmAction formId="users-form" action={userAction} extra={{ pool: id, op: "delete" }} label="Delete" title="Delete users" noun="user" confirmWord="delete" />
                    <ModalButton label="Create user" title="Create user" variant="primary">
                      <form action={createUser} className="space-y-4">
                        {hidden}
                        {!emailLogin && <FormField label="User name"><Input name="username" required autoFocus /></FormField>}
                        <FormField label={emailLogin ? "Email address" : <>Email address <i className="font-normal text-muted">- optional</i></>}><Input name="email" type="email" required={emailLogin} autoFocus={emailLogin} /></FormField>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" defaultChecked className="accent-accent" /> Mark email address as verified</label>
                        <FormField label={<>Temporary password <i className="font-normal text-muted">- optional, generated if empty</i></>} description="A test value for this local pool; the user must change it at first sign-in."><Input name="tempPassword" type="text" autoComplete="off" /></FormField>
                        <div className="flex justify-end"><button className={buttonClass("primary")}>Create user</button></div>
                      </form>
                    </ModalButton>
                  </>
                }
              >
                Users
              </Header>
              <TableFilter tableId="users-table" placeholder="Search users by attribute" />
            </div>
          }
        >
          <form id="users-form" />
          <Table
            id="users-table"
            formId="users-form"
            selection="multi"
            rows={users}
            rowKey={(u) => u.Username!}
            filterText={(u) => `${u.Username} ${attr(u, "email") ?? ""}`}
            columns={[
              { header: "User name", cell: (u) => <span className="font-mono text-[13px]">{u.Username}</span> },
              { header: "Email address", cell: (u) => attr(u, "email") ?? "-" },
              { header: "Email verified", cell: (u) => (attr(u, "email_verified") === "true" ? "Yes" : "No") },
              { header: "Confirmation status", cell: (u) => userStatus(u.UserStatus) },
              { header: "Status", cell: (u) => (u.Enabled ? <StatusIndicator type="success">Enabled</StatusIndicator> : <StatusIndicator type="stopped">Disabled</StatusIndicator>) },
              { header: "Created", cell: (u) => formatDate(u.UserCreateDate) },
            ]}
            empty={<EmptyState title="No users" />}
          />
        </Container>
      )}
      {tab === "groups" && (
        <>
          <Container
            noPadding
            header={
              <Header
                counter={groups.length}
                actions={
                  <>
                    <ConfirmAction formId="groups-form" action={deleteGroups} extra={{ pool: id }} label="Delete" title="Delete group" noun="group" confirmWord="delete" />
                    <ModalButton label="Create group" title="Create group" variant="primary">
                      <form action={createGroup} className="space-y-4">
                        {hidden}
                        <FormField label="Group name"><Input name="name" required autoFocus /></FormField>
                        <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                        <FormField label={<>Precedence <i className="font-normal text-muted">- optional</i></>}><Input name="precedence" type="number" min={0} /></FormField>
                        <div className="flex justify-end"><button className={buttonClass("primary")}>Create group</button></div>
                      </form>
                    </ModalButton>
                  </>
                }
              >
                Groups
              </Header>
            }
          >
            <form id="groups-form" />
            <Table
              formId="groups-form"
              selection="multi"
              rows={groups}
              rowKey={(g) => g.GroupName!}
              columns={[
                { header: "Group name", cell: (g) => g.GroupName },
                { header: "Description", cell: (g) => g.Description || "-" },
                { header: "Precedence", cell: (g) => g.Precedence ?? "-" },
                { header: "Members", cell: (g) => <span className="flex flex-wrap gap-1">{memberships.filter((m) => m.groups.includes(g.GroupName!)).map((m) => (
                  <form key={m.user} action={removeFromGroup} className="inline">
                    {hidden}
                    <input type="hidden" name="user" value={m.user} />
                    <input type="hidden" name="group" value={g.GroupName} />
                    <Badge>{m.user} <button aria-label={`Remove ${m.user}`} className="ml-1 text-muted hover:text-danger">×</button></Badge>
                  </form>
                ))}</span> },
                { header: "Created", cell: (g) => formatDate(g.CreationDate) },
              ]}
              empty={<EmptyState title="No groups" />}
            />
          </Container>
          <Container header={<Header description="Select users on the Users tab list below and add them to a group.">Add users to a group</Header>}>
            <form id="add-form" />
            <div className="space-y-3">
              {users.map((u) => (
                <label key={u.Username} className="mr-4 inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" name="selected" value={u.Username} form="add-form" data-select className="accent-accent" /> {attr(u, "email") ?? u.Username}
                </label>
              ))}
              {users.length === 0 && <p className="text-muted">No users yet.</p>}
              <div className="sel-scope flex items-center gap-2">
                <ConfirmAction
                  formId="add-form"
                  action={addToGroup}
                  extra={{ pool: id }}
                  label="Add to group"
                  title="Add users to group"
                  noun="user"
                  confirmWord="add"
                  confirmLabel="Add"
                  fields={<div className="space-y-1"><label className="block text-sm font-bold">Group</label><Select name="group">{groups.map((g) => <option key={g.GroupName}>{g.GroupName}</option>)}</Select></div>}
                />
              </div>
            </div>
          </Container>
        </>
      )}
      {tab === "clients" && (
        <Container
          noPadding
          header={
            <Header
              counter={clientsRes.UserPoolClients?.length ?? 0}
              actions={
                <>
                  <ConfirmAction formId="clients-form" action={deleteClients} extra={{ pool: id }} label="Delete" title="Delete app client" noun="app client" confirmWord="delete" />
                  <ModalButton label="Create app client" title="Create app client" variant="primary">
                    <form action={createClient} className="space-y-4">
                      {hidden}
                      <FormField label="App client name"><Input name="name" required autoFocus /></FormField>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="secret" className="accent-accent" /> Generate a client secret</label>
                      <FormField label="Authentication flows">
                        <div className="space-y-1">
                          {["ALLOW_USER_SRP_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_ADMIN_USER_PASSWORD_AUTH", "ALLOW_CUSTOM_AUTH"].map((f) => (
                            <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" name="flows" value={f} defaultChecked={f !== "ALLOW_CUSTOM_AUTH" && f !== "ALLOW_ADMIN_USER_PASSWORD_AUTH"} className="accent-accent" /> {f}</label>
                          ))}
                        </div>
                      </FormField>
                      <FormField label={<>Callback URL <i className="font-normal text-muted">- optional</i></>}><Input name="callback" placeholder="http://localhost:3000/callback" /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create app client</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              App clients
            </Header>
          }
        >
          <form id="clients-form" />
          <Table
            formId="clients-form"
            selection="multi"
            rows={clientsRes.UserPoolClients ?? []}
            rowKey={(c) => c.ClientId!}
            columns={[
              { header: "App client name", cell: (c) => c.ClientName },
              { header: "Client ID", cell: (c) => <span className="font-mono text-[13px]">{c.ClientId}</span> },
            ]}
            empty={<EmptyState title="No app clients" />}
          />
        </Container>
      )}
      {tab === "domain" && (
        <Container header={<Header description="A Cognito domain hosts the managed login pages for the user pool.">Domain</Header>}>
          <form action={setDomain} className="space-y-4">
            {hidden}
            <input type="hidden" name="existing" value={pool.Domain ?? ""} />
            {pool.Domain ? (
              <>
                <KeyValue items={[{ label: "Cognito domain", value: <span className="font-mono text-[13px]">https://{pool.Domain}.auth.us-east-1.amazoncognito.com</span> }]} />
                <div className="flex justify-end"><button className={buttonClass("normal")}>Delete domain</button></div>
              </>
            ) : (
              <>
                <FormField label="Cognito domain prefix" constraint="Lowercase letters, numbers and hyphens."><Input name="domain" required pattern="[a-z0-9\-]+" /></FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Create Cognito domain</button></div>
              </>
            )}
          </form>
        </Container>
      )}
    </Page>
  );
}
