import { GetRoleCommand, ListAttachedRolePoliciesCommand } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Container, ErrorAlert, Header, KeyValue } from "@/components/ui";
import { AttachedPolicies } from "../../attached-policies";

export default async function RolePage({ params }: PageProps<"/iam/roles/[name]">) {
  const name = decodeURIComponent((await params).name);
  let data;
  try {
    const { iam } = await aws();
    data = await Promise.all([iam.send(new GetRoleCommand({ RoleName: name })), iam.send(new ListAttachedRolePoliciesCommand({ RoleName: name }))]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [role, pols] = data;
  const r = role.Role!;
  let trust = r.AssumeRolePolicyDocument ?? "";
  try {
    trust = JSON.stringify(JSON.parse(decodeURIComponent(trust)), null, 2);
  } catch {}
  return (
    <Page>
      <Header variant="h1" info>{name}</Header>
      <Container header={<Header>Summary</Header>}>
        <KeyValue
          items={[
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{r.Arn}</span> },
            { label: "Creation date", value: formatDate(r.CreateDate) },
            { label: "Description", value: r.Description || "-" },
            { label: "Maximum session duration", value: `${(r.MaxSessionDuration ?? 3600) / 3600} hour` },
          ]}
        />
      </Container>
      <AttachedPolicies kind="role" principal={name} policies={pols.AttachedPolicies ?? []} />
      <Container header={<Header>Trust policy</Header>}>
        <pre className="overflow-auto rounded-lg bg-code p-3 font-mono text-[13px]">{trust}</pre>
      </Container>
    </Page>
  );
}
