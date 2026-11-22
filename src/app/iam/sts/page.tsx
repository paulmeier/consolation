import { ListRolesCommand } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Container, ErrorAlert, Header } from "@/components/ui";
import { StsPlayground } from "./playground";

export const metadata = { title: "STS playground | IAM" };

export default async function StsPage() {
  let roles: { name: string; arn: string }[] = [];
  let error: string | null = null;
  try {
    const { iam } = await aws();
    roles = ((await iam.send(new ListRolesCommand({ MaxItems: 1000 }))).Roles ?? []).map((r) => ({ name: r.RoleName!, arn: r.Arn! }));
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Header variant="h1" description="Call AWS Security Token Service against the emulator and get temporary credentials. AssumeRole checks the role's trust policy: to assume a role from here, trust the account (arn:aws:iam::000000000000:root) or the emulator user.">
        STS playground
      </Header>
      {error && <ErrorAlert message={error} />}
      <Container>
        <StsPlayground roles={roles} />
      </Container>
    </Page>
  );
}
