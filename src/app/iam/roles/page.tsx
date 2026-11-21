import Link from "next/link";
import { Suspense } from "react";
import { ListRolesCommand, type Role } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createRole, deleteRoles } from "../actions";

export const metadata = { title: "Roles | IAM" };
const FORM = "roles-form";

function trusted(r: Role) {
  try {
    const doc = JSON.parse(decodeURIComponent(r.AssumeRolePolicyDocument ?? "{}"));
    const p = doc.Statement?.[0]?.Principal ?? {};
    const v = p.Service ?? p.AWS ?? p.Federated;
    return `AWS Service: ${(Array.isArray(v) ? v : [v]).filter(Boolean).map((s: string) => s.replace(".amazonaws.com", "")).join(", ")}`;
  } catch {
    return "-";
  }
}

async function Roles() {
  let roles: Role[] = [];
  let error: string | null = null;
  try {
    const { iam } = await aws();
    roles = (await iam.send(new ListRolesCommand({ MaxItems: 1000 }))).Roles ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={roles.length}
            info
            description="An IAM role is an identity you can create that has specific permissions with credentials that are valid for short durations."
            actions={
              <>
                <LinkButton href="/iam/roles" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteRoles} label="Delete" title="Delete role" noun="role" confirmWord="delete" />
                <ModalButton label="Create role" title="Create role" variant="primary">
                  <form action={createRole} className="space-y-4">
                    <FormField label="Trusted entity" description="Allow an AWS service to assume this role.">
                      <Select name="service" defaultValue="lambda">
                        <option value="lambda">Lambda</option>
                        <option value="ec2">EC2</option>
                        <option value="ecs">Elastic Container Service</option>
                        <option value="states">Step Functions</option>
                      </Select>
                    </FormField>
                    <FormField label="Role name" constraint="Maximum 64 characters. Use alphanumeric and '+=,.@-_' characters.">
                      <Input name="name" required maxLength={64} pattern="[\w+=,.@\-]+" />
                    </FormField>
                    <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}>
                      <Input name="description" maxLength={1000} />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create role</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Roles
          </Header>
          <TableFilter tableId="roles-table" placeholder="Search" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="roles-table"
        formId={FORM}
        selection="multi"
        rows={roles}
        rowKey={(r) => r.RoleName!}
        filterText={(r) => r.RoleName!}
        columns={[
          { header: "Role name", cell: (r) => <Link className="underline-link" href={`/iam/roles/${encodeURIComponent(r.RoleName!)}`}>{r.RoleName}</Link> },
          { header: "Trusted entities", cell: trusted },
          { header: "Creation time", cell: (r) => formatDate(r.CreateDate) },
        ]}
        empty={<EmptyState title="No resources to display" />}
      />
    </Container>
  );
}

export default function RolesPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Roles</Header>}>Loading roles…</Container>}>
        <Roles />
      </Suspense>
    </Page>
  );
}
