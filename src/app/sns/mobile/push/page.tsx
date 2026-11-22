import { ListPlatformApplicationsCommand, type PlatformApplication } from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { createPlatformApp, deletePlatformApps } from "../../actions";

export const metadata = { title: "Mobile push notifications | Amazon SNS" };

const PLATFORMS = [
  ["GCM", "Firebase Cloud Messaging (FCM)"],
  ["APNS", "Apple iOS/VoIP/macOS"],
  ["APNS_SANDBOX", "Apple sandbox"],
  ["ADM", "Amazon Device Messaging (ADM)"],
  ["BAIDU", "Baidu Cloud Push"],
  ["MPNS", "Microsoft MPNS"],
  ["WNS", "Microsoft WNS"],
];

export default async function PushPage() {
  let apps: PlatformApplication[] = [];
  let error: string | null = null;
  try {
    const { sns } = await aws();
    apps = (await sns.send(new ListPlatformApplicationsCommand({}))).PlatformApplications ?? [];
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
            counter={apps.length}
            description="Platform applications represent a mobile app registered with a push notification service."
            actions={
              <>
                <ConfirmAction formId="apps-form" action={deletePlatformApps} label="Delete" title="Delete platform applications" noun="platform application" />
                <ModalButton label="Create platform application" title="Create platform application" variant="primary">
                  <form action={createPlatformApp} className="space-y-4">
                    <FormField label="Application name" constraint="Up to 256 letters, numbers, hyphens, underscores and periods.">
                      <Input name="name" required pattern="[A-Za-z0-9_.\-]{1,256}" />
                    </FormField>
                    <FormField label="Push notification platform">
                      <Select name="platform">{PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                    </FormField>
                    <FormField label="Platform credential" description="API key, server key, or private key. The emulator sends no notifications but checks the format of FCM and APNs credentials.">
                      <Textarea name="credential" rows={3} required />
                    </FormField>
                    <FormField label={<>Platform principal <i className="font-normal text-muted">- for APNs and ADM</i></>}>
                      <Input name="principal" />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create platform application</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Platform applications
          </Header>
        }
      >
        <form id="apps-form" />
        <Table
          formId="apps-form"
          selection="multi"
          rows={apps}
          rowKey={(a) => a.PlatformApplicationArn ?? ""}
          columns={[
            { header: "Name", cell: (a) => <a className="text-accent hover:underline" href={`/sns/mobile/push/${encodeURIComponent(a.PlatformApplicationArn ?? "")}`}>{a.PlatformApplicationArn?.split("/").pop()}</a> },
            { header: "Platform", cell: (a) => a.PlatformApplicationArn?.split("/")[1] },
            { header: "Status", cell: (a) => (a.Attributes?.Enabled === "false" ? <StatusIndicator type="stopped">Disabled</StatusIndicator> : <StatusIndicator type="success">Enabled</StatusIndicator>) },
            { header: "ARN", cell: (a) => <span className="font-mono text-[13px] break-all">{a.PlatformApplicationArn}</span> },
          ]}
          empty={<EmptyState title="No platform applications" description="Create a platform application to send push notifications." />}
        />
      </Container>
    </Page>
  );
}
