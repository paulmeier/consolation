import { DescribeIdentityPoolCommand, ListIdentityPoolsCommand, type IdentityPool } from "@aws-sdk/client-cognito-identity";
import { ListUserPoolClientsCommand, ListUserPoolsCommand } from "@aws-sdk/client-cognito-identity-provider";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createIdentityPool, deleteIdentityPools } from "../actions";

export const metadata = { title: "Identity pools | Cognito" };

export default async function IdentityPoolsPage() {
  let pools: IdentityPool[] = [];
  let userPools: { value: string; label: string }[] = [];
  let error: string | null = null;
  try {
    const { cognito, cognitoIdentity } = await aws();
    const ids = (await cognitoIdentity.send(new ListIdentityPoolsCommand({ MaxResults: 60 }))).IdentityPools ?? [];
    pools = await Promise.all(ids.map((p) => cognitoIdentity.send(new DescribeIdentityPoolCommand({ IdentityPoolId: p.IdentityPoolId }))));
    const ups = (await cognito.send(new ListUserPoolsCommand({ MaxResults: 60 }))).UserPools ?? [];
    userPools = (await Promise.all(ups.map(async (u) => ((await cognito.send(new ListUserPoolClientsCommand({ UserPoolId: u.Id, MaxResults: 60 }))).UserPoolClients ?? []).map((c) => ({ value: `${u.Id}|${c.ClientId}`, label: `${u.Name} / ${c.ClientName}` }))))).flat();
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Container
        noPadding
        header={
          <Header
            counter={pools.length}
            info
            description="Identity pools exchange user pool or guest identities for AWS credentials."
            actions={
              <>
                <LinkButton href="/cognito/identity-pools" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId="ip-form" action={deleteIdentityPools} label="Delete" title="Delete identity pool" noun="identity pool" confirmWord="delete" />
                <ModalButton label="Create identity pool" title="Create identity pool" variant="primary">
                  <form action={createIdentityPool} className="space-y-4">
                    <FormField label="Identity pool name"><Input name="name" required pattern="[\w ]+" autoFocus /></FormField>
                    <FormField label="Amazon Cognito user pool"><Select name="userPool" defaultValue=""><option value="">None</option>{userPools.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</Select></FormField>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="guest" className="accent-accent" /> Activate guest access</label>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create identity pool</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Identity pools
          </Header>
        }
      >
        <form id="ip-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          formId="ip-form"
          selection="multi"
          rows={pools}
          rowKey={(p) => p.IdentityPoolId!}
          columns={[
            { header: "Identity pool name", cell: (p) => p.IdentityPoolName },
            { header: "Identity pool ID", cell: (p) => <span className="font-mono text-[13px]">{p.IdentityPoolId}</span> },
            { header: "Guest access", cell: (p) => (p.AllowUnauthenticatedIdentities ? "Active" : "Inactive") },
            { header: "User pools", cell: (p) => (p.CognitoIdentityProviders ?? []).map((c) => c.ProviderName?.split("/").pop()).join(", ") || "-" },
          ]}
          empty={<EmptyState title="No identity pools" />}
        />
      </Container>
    </Page>
  );
}
