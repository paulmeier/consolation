import Link from "next/link";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { ListAccessPointsCommand, type AccessPoint } from "@aws-sdk/client-s3-control";
import { aws, errorMessage, EMULATOR_ACCOUNT } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { createAccessPoint, deleteAccessPoints } from "../actions";

export const metadata = { title: "Access Points | S3" };

export default async function AccessPointsPage() {
  let points: AccessPoint[] = [];
  let buckets: string[] = [];
  let error: string | null = null;
  try {
    const { s3, s3control } = await aws();
    const [ap, b] = await Promise.all([s3control.send(new ListAccessPointsCommand({ AccountId: EMULATOR_ACCOUNT })), s3.send(new ListBucketsCommand({}))]);
    points = ap.AccessPointList ?? [];
    buckets = (b.Buckets ?? []).map((x) => x.Name!);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            variant="h1"
            counter={points.length}
            info
            description="Named network endpoints attached to a bucket, each with its own access policy."
            actions={
              <>
                <ConfirmAction formId="ap-form" action={deleteAccessPoints} label="Delete" title="Delete access point" noun="access point" />
                <ModalButton label="Create access point" title="Create access point" variant="primary">
                  <form action={createAccessPoint} className="space-y-4">
                    <FormField label="Access point name" constraint="3 to 50 lowercase letters, numbers and hyphens."><Input name="name" required pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]" /></FormField>
                    <FormField label="Bucket"><Select name="bucket">{buckets.map((b) => <option key={b}>{b}</option>)}</Select></FormField>
                    <FormField label={<>VPC ID <i className="font-normal text-muted">- for a Virtual private cloud network origin</i></>}><Input name="vpc" placeholder="Leave empty for Internet" /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!buckets.length}>Create access point</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Access Points
          </Header>
        }
      >
        <form id="ap-form" />
        <Table
          formId="ap-form"
          selection="multi"
          rows={points}
          rowKey={(a) => a.Name!}
          columns={[
            { header: "Name", cell: (a) => <Link className="text-accent hover:underline" href={`/s3/access-points/${encodeURIComponent(a.Name!)}`}>{a.Name}</Link> },
            { header: "Bucket", cell: (a) => <Link className="underline-link" href={`/s3/buckets/${encodeURIComponent(a.Bucket!)}`}>{a.Bucket}</Link> },
            { header: "Network origin", cell: (a) => a.NetworkOrigin },
            { header: "Alias", cell: (a) => <span className="font-mono text-[13px] break-all">{a.Alias}</span> },
            { header: "ARN", cell: (a) => <span className="font-mono text-[13px] break-all">{a.AccessPointArn}</span> },
          ]}
          empty={<EmptyState title="No access points" />}
        />
      </Container>
    </Page>
  );
}
