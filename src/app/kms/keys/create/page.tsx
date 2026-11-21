import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { createKey } from "../../actions";

export const metadata = { title: "Create key | KMS" };

export default function CreateKey() {
  return (
    <Page>
      <Header variant="h1" info>Create key</Header>
      <form action={createKey} className="flex max-w-[960px] flex-col gap-6">
        <Container header={<Header>Configure key</Header>}>
          <div className="space-y-5">
            <FormField label="Key usage" description="Encrypt and decrypt (symmetric or RSA), sign and verify (RSA/ECC), or generate and verify MAC (HMAC).">
              <Select name="usage" defaultValue="ENCRYPT_DECRYPT">
                <option value="ENCRYPT_DECRYPT">Encrypt and decrypt</option>
                <option value="SIGN_VERIFY">Sign and verify</option>
                <option value="GENERATE_VERIFY_MAC">Generate and verify MAC</option>
              </Select>
            </FormField>
            <FormField label="Key spec" description="Must match the key usage: SYMMETRIC_DEFAULT or RSA for encryption; RSA or ECC for signing; HMAC for MAC.">
              <Select name="spec" defaultValue="SYMMETRIC_DEFAULT">
                {["SYMMETRIC_DEFAULT", "RSA_2048", "RSA_3072", "RSA_4096", "ECC_NIST_P256", "ECC_NIST_P384", "ECC_NIST_P521", "ECC_SECG_P256K1", "HMAC_224", "HMAC_256", "HMAC_384", "HMAC_512"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </FormField>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="multiRegion" className="accent-accent" /> Multi-Region key</label>
          </div>
        </Container>
        <Container header={<Header>Add labels</Header>}>
          <div className="space-y-5">
            <FormField label="Alias" constraint="Alias names can contain alphanumeric characters, forward slashes (/), underscores (_), and dashes (-). Don't start with aws/.">
              <Input name="alias" placeholder="my-app-key" pattern="(alias\/)?[A-Za-z0-9\/_\-]+" />
            </FormField>
            <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}>
              <Input name="description" maxLength={8192} />
            </FormField>
          </div>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/kms/keys" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Create key</button>
        </div>
      </form>
    </Page>
  );
}
