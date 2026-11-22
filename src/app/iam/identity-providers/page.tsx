import { GetOpenIDConnectProviderCommand, ListOpenIDConnectProvidersCommand, ListSAMLProvidersCommand } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Textarea, buttonClass } from "@/components/ui";
import { createOidcProvider, createSamlProvider, deleteIdentityProviders } from "../actions";

export const metadata = { title: "Identity providers | IAM" };

type Row = { arn: string; name: string; type: "OpenID Connect" | "SAML"; created?: Date; detail: string };

export default async function IdentityProvidersPage() {
  const rows: Row[] = [];
  let error: string | null = null;
  try {
    const { iam } = await aws();
    const [oidc, saml] = await Promise.all([iam.send(new ListOpenIDConnectProvidersCommand({})), iam.send(new ListSAMLProvidersCommand({}))]);
    for (const p of oidc.OpenIDConnectProviderList ?? []) {
      const d = await iam.send(new GetOpenIDConnectProviderCommand({ OpenIDConnectProviderArn: p.Arn! }));
      rows.push({ arn: p.Arn!, name: d.Url ?? p.Arn!.split("oidc-provider/").pop()!, type: "OpenID Connect", created: d.CreateDate, detail: `Audiences: ${(d.ClientIDList ?? []).join(", ") || "-"}` });
    }
    for (const p of saml.SAMLProviderList ?? []) rows.push({ arn: p.Arn!, name: p.Arn!.split("/").pop()!, type: "SAML", created: p.CreateDate, detail: p.ValidUntil ? `Valid until ${p.ValidUntil.toISOString().slice(0, 10)}` : "-" });
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            variant="h1"
            counter={rows.length}
            info
            description="Identity providers let users from an external identity system (OIDC or SAML 2.0) assume IAM roles."
            actions={
              <>
                <ConfirmAction formId="idp-form" action={deleteIdentityProviders} label="Delete" title="Delete identity provider" noun="identity provider" />
                <ModalButton label="Add SAML provider" title="Add SAML identity provider" size="lg">
                  <form action={createSamlProvider} className="space-y-4">
                    <FormField label="Provider name" constraint="Up to 128 letters, numbers, periods, underscores and hyphens.">
                      <Input name="name" required pattern="[\w.\-]{1,128}" />
                    </FormField>
                    <FormField label="Metadata document" description="The SAML metadata XML from your identity provider.">
                      <Textarea name="metadata" rows={10} required placeholder='<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" ...>' />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Add provider</button></div>
                  </form>
                </ModalButton>
                <ModalButton label="Add OpenID Connect provider" title="Add OpenID Connect identity provider" variant="primary">
                  <form action={createOidcProvider} className="space-y-4">
                    <FormField label="Provider URL" constraint="Must begin with https://">
                      <Input name="url" required type="url" pattern="https://.*" placeholder="https://token.actions.githubusercontent.com" />
                    </FormField>
                    <FormField label="Audience" description="Client IDs, comma separated.">
                      <Input name="audiences" required placeholder="sts.amazonaws.com" />
                    </FormField>
                    <FormField label={<>Thumbprints <i className="font-normal text-muted">- optional</i></>} description="40-character SHA-1 hex thumbprints, comma separated.">
                      <Input name="thumbprints" />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Add provider</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Identity providers
          </Header>
        }
      >
        <form id="idp-form" />
        <Table
          formId="idp-form"
          selection="multi"
          rows={rows}
          rowKey={(r) => r.arn}
          columns={[
            { header: "Provider", cell: (r) => <span className="break-all">{r.name}</span> },
            { header: "Type", cell: (r) => r.type },
            { header: "Details", cell: (r) => r.detail },
            { header: "Creation time", cell: (r) => formatDate(r.created) },
            { header: "ARN", cell: (r) => <span className="font-mono text-[13px] break-all">{r.arn}</span> },
          ]}
          empty={<EmptyState title="No identity providers" description="Add an OpenID Connect or SAML provider." />}
        />
      </Container>
    </Page>
  );
}
