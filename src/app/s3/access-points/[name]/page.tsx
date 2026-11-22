import { GetAccessPointCommand, GetAccessPointPolicyCommand } from "@aws-sdk/client-s3-control";
import { aws, errorMessage, EMULATOR_ACCOUNT, REGION } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, ErrorAlert, Header, KeyValue, Textarea, buttonClass } from "@/components/ui";
import { deleteAccessPoints, saveAccessPointPolicy } from "../../actions";

export default async function AccessPointPage({ params }: PageProps<"/s3/access-points/[name]">) {
  const name = decodeURIComponent((await params).name);
  let ap, policy = "";
  try {
    const { s3control } = await aws();
    ap = await s3control.send(new GetAccessPointCommand({ AccountId: EMULATOR_ACCOUNT, Name: name }));
    policy = await s3control
      .send(new GetAccessPointPolicyCommand({ AccountId: EMULATOR_ACCOUNT, Name: name }))
      .then((r) => (r.Policy ? JSON.stringify(JSON.parse(r.Policy), null, 2) : ""))
      .catch(() => "");
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const arn = `arn:aws:s3:${REGION}:${EMULATOR_ACCOUNT}:accesspoint/${name}`;
  const sample = JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: { AWS: `arn:aws:iam::${EMULATOR_ACCOUNT}:root` }, Action: ["s3:GetObject"], Resource: `${arn}/object/*` }] }, null, 2);
  const c = ap.PublicAccessBlockConfiguration;
  return (
    <Page>
      <Header variant="h1" actions={<ConfirmAction action={deleteAccessPoints} values={[name]} extra={{ redirect: "1" }} label="Delete" title="Delete access point" noun="access point" />}>
        {name}
      </Header>
      <Container header={<Header>Properties</Header>}>
        <KeyValue
          items={[
            { label: "Bucket", value: ap.Bucket },
            { label: "Network origin", value: ap.NetworkOrigin === "VPC" ? `VPC (${ap.VpcConfiguration?.VpcId})` : "Internet" },
            { label: "Creation date", value: formatDate(ap.CreationDate) },
            { label: "Access point alias", value: <span className="font-mono text-[13px] break-all">{ap.Alias}</span> },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{arn}</span> },
            { label: "Block public access", value: [c?.BlockPublicAcls, c?.IgnorePublicAcls, c?.BlockPublicPolicy, c?.RestrictPublicBuckets].every(Boolean) ? "On" : "Partially off" },
          ]}
        />
      </Container>
      <Container header={<Header info description="Written in JSON. Empty and save to delete it.">Access point policy</Header>}>
        <form action={saveAccessPointPolicy} className="space-y-3">
          <input type="hidden" name="name" value={name} />
          <Textarea name="json" rows={12} spellCheck={false} defaultValue={policy} placeholder={sample} />
          <div className="flex justify-end"><button className={buttonClass("normal")}>Save changes</button></div>
        </form>
      </Container>
    </Page>
  );
}
