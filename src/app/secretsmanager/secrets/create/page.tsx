import { Page } from "@/components/page";
import { KeyValueEditor } from "@/components/client/kv-editor";
import { Container, FormField, Header, Input, LinkButton, buttonClass } from "@/components/ui";
import { createSecret } from "../../actions";

export const metadata = { title: "Store a new secret | Secrets Manager" };

export default function CreateSecret() {
  return (
    <Page>
      <Header variant="h1" info>Store a new secret</Header>
      <form action={createSecret} className="flex max-w-[960px] flex-col gap-6">
        <Container header={<Header>Secret type</Header>}>
          <label className="flex items-start gap-3 rounded-xl border-2 border-accent bg-accent-soft p-4">
            <input type="radio" defaultChecked readOnly className="mt-1 accent-accent" />
            <span>
              <b>Other type of secret</b>
              <span className="block text-sm text-muted">API key, OAuth token, other.</span>
            </span>
          </label>
        </Container>
        <Container header={<Header>Key/value pairs</Header>}>
          <KeyValueEditor name="value" />
        </Container>
        <Container header={<Header>Configure secret</Header>}>
          <div className="space-y-5">
            <FormField label="Secret name" description="A descriptive name that helps you find your secret later." constraint="Secret name must contain only alphanumeric characters and the characters /_+=.@-">
              <Input name="name" required maxLength={512} pattern="[A-Za-z0-9\/_+=.@\-]+" placeholder="prod/AppBeta/MySql" />
            </FormField>
            <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}>
              <Input name="description" maxLength={2048} placeholder="Access to MYSQL prod database for my AppBeta" />
            </FormField>
            <FormField label={<>Encryption key <i className="font-normal text-muted">- optional</i></>} description="Leave empty to use aws/secretsmanager, or enter a KMS key ID, ARN or alias.">
              <Input name="kmsKeyId" placeholder="aws/secretsmanager" />
            </FormField>
          </div>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/secretsmanager/secrets" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Store</button>
        </div>
      </form>
    </Page>
  );
}
