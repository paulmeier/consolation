import { GetPlatformApplicationAttributesCommand, ListEndpointsByPlatformApplicationCommand, type Endpoint } from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { createEndpoint, deleteEndpoints, publishToEndpoint, setEndpointEnabled } from "../../../actions";

export default async function PlatformAppPage({ params }: PageProps<"/sns/mobile/push/[app]">) {
  const arn = decodeURIComponent((await params).app);
  const name = arn.split("/").pop()!;
  let attrs: Record<string, string> = {};
  let endpoints: Endpoint[] = [];
  try {
    const { sns } = await aws();
    attrs = (await sns.send(new GetPlatformApplicationAttributesCommand({ PlatformApplicationArn: arn }))).Attributes ?? {};
    endpoints = (await sns.send(new ListEndpointsByPlatformApplicationCommand({ PlatformApplicationArn: arn }))).Endpoints ?? [];
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const app = <input type="hidden" name="app" value={arn} />;
  return (
    <Page>
      <Header variant="h1">{name}</Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          items={[
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{arn}</span> },
            { label: "Platform", value: arn.split("/")[1] },
            { label: "Status", value: attrs.Enabled === "false" ? "Disabled" : "Enabled" },
            { label: "Endpoints", value: String(endpoints.length) },
          ]}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={endpoints.length}
            description="Each endpoint is one device (a device token) of this app."
            actions={
              <>
                <ConfirmAction formId="ep-form" action={deleteEndpoints} extra={{ app: arn }} label="Delete" title="Delete endpoints" noun="endpoint" />
                <button form="ep-form" name="enable" value="false" className={`${buttonClass("normal")} needs-selection`}>Disable</button>
                <button form="ep-form" name="enable" value="true" className={`${buttonClass("normal")} needs-selection`}>Enable</button>
                {endpoints.length > 0 && (
                  <ModalButton label="Publish message" title="Publish message to endpoint">
                    <form action={publishToEndpoint} className="space-y-4">
                      {app}
                      <FormField label="Endpoint">
                        <Select name="endpoint">{endpoints.map((e) => <option key={e.EndpointArn} value={e.EndpointArn}>{e.EndpointArn?.split("/").pop()}</option>)}</Select>
                      </FormField>
                      <FormField label="Message">
                        <Textarea name="message" rows={5} required />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Publish message</button></div>
                    </form>
                  </ModalButton>
                )}
                <ModalButton label="Create application endpoint" title="Create application endpoint" variant="primary">
                  <form action={createEndpoint} className="space-y-4">
                    {app}
                    <FormField label="Device token">
                      <Textarea name="token" rows={3} required />
                    </FormField>
                    <FormField label={<>User data <i className="font-normal text-muted">- optional</i></>}>
                      <Input name="userData" />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create application endpoint</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Endpoints
          </Header>
        }
      >
        <form id="ep-form" action={setEndpointEnabled}>{app}</form>
        <Table
          formId="ep-form"
          selection="multi"
          rows={endpoints}
          rowKey={(e) => e.EndpointArn ?? ""}
          columns={[
            { header: "Endpoint ARN", cell: (e) => <span className="font-mono text-[13px] break-all">{e.EndpointArn}</span> },
            { header: "Device token", cell: (e) => <span className="font-mono text-[13px] break-all">{e.Attributes?.Token}</span> },
            { header: "User data", cell: (e) => e.Attributes?.CustomUserData || "-" },
            { header: "Status", cell: (e) => (e.Attributes?.Enabled === "false" ? <StatusIndicator type="stopped">Disabled</StatusIndicator> : <StatusIndicator type="success">Enabled</StatusIndicator>) },
          ]}
          empty={<EmptyState title="No endpoints" description="Create an application endpoint with a device token." />}
        />
      </Container>
    </Page>
  );
}
