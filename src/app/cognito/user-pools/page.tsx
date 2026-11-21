import Link from "next/link";
import { ListUserPoolsCommand, type UserPoolDescriptionType } from "@aws-sdk/client-cognito-identity-provider";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createUserPool, deleteUserPools } from "../actions";

export const metadata = { title: "User pools | Cognito" };

export default async function PoolsPage() {
  let pools: UserPoolDescriptionType[] = [];
  let error: string | null = null;
  try {
    const { cognito } = await aws();
    pools = (await cognito.send(new ListUserPoolsCommand({ MaxResults: 60 }))).UserPools ?? [];
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
              counter={pools.length}
              info
              actions={
                <>
                  <LinkButton href="/cognito/user-pools" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="pools-form" action={deleteUserPools} label="Delete" title="Delete user pool" noun="user pool" confirmWord="delete" description="Deleting a user pool deletes all of its users. Pools with deletion protection must have it turned off first." />
                  <ModalButton label="Create user pool" title="Set up resources for your application" variant="primary">
                    <form action={createUserPool} className="space-y-4">
                      <FormField label="Name your user pool"><Input name="name" required maxLength={128} autoFocus /></FormField>
                      <FormField label="Options for sign-in identifiers">
                        <Select name="signIn" defaultValue="email"><option value="email">Email</option><option value="username">Username</option></Select>
                      </FormField>
                      <FormField label="Password minimum length"><Input name="minLength" type="number" min={6} max={99} defaultValue={8} /></FormField>
                      <FormField label={<>App client name <i className="font-normal text-muted">- optional</i></>}><Input name="client" placeholder="my-app" /></FormField>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="protect" className="accent-accent" /> Activate deletion protection</label>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create user pool</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              User pools
            </Header>
            <TableFilter tableId="pools-table" placeholder="Search user pools" />
          </div>
        }
      >
        <form id="pools-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="pools-table"
          formId="pools-form"
          selection="single"
          rows={pools}
          rowKey={(p) => p.Id!}
          filterText={(p) => `${p.Name} ${p.Id}`}
          columns={[
            { header: "User pool name", cell: (p) => <Link className="underline-link" href={`/cognito/user-pools/${p.Id}`}>{p.Name}</Link> },
            { header: "User pool ID", cell: (p) => <span className="font-mono text-[13px]">{p.Id}</span> },
            { header: "Created time", cell: (p) => formatDate(p.CreationDate) },
            { header: "Last updated", cell: (p) => formatDate(p.LastModifiedDate) },
          ]}
          empty={<EmptyState title="No user pools" />}
        />
      </Container>
    </Page>
  );
}
