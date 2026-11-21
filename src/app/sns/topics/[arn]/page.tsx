import { GetTopicAttributesCommand, ListSubscriptionsByTopicCommand, type Subscription } from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { publish, subscribe, unsubscribe } from "../../actions";

const FORM = "subs-form";

export default async function TopicPage({ params }: PageProps<"/sns/topics/[arn]">) {
  const arn = decodeURIComponent((await params).arn);
  const name = arn.split(":").pop()!;
  let attrs: Record<string, string> = {};
  let subs: Subscription[] = [];
  try {
    const { sns } = await aws();
    attrs = (await sns.send(new GetTopicAttributesCommand({ TopicArn: arn }))).Attributes ?? {};
    subs = (await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: arn }))).Subscriptions ?? [];
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const fifo = arn.endsWith(".fifo");
  return (
    <Page>
      <Header
        variant="h1"
        actions={
          <ModalButton label="Publish message" title={`Publish message to ${name}`} variant="primary" size="lg">
            <form action={publish} className="space-y-4">
              <input type="hidden" name="topic" value={arn} />
              <FormField label={<>Subject <i className="font-normal text-muted">- optional</i></>}>
                <Input name="subject" maxLength={100} placeholder="Enter a subject" />
              </FormField>
              {fifo && (
                <FormField label="Message group ID">
                  <Input name="group" defaultValue="default" required />
                </FormField>
              )}
              <FormField label="Message body" constraint="Maximum 256 KB.">
                <Textarea name="message" rows={8} required />
              </FormField>
              <div className="flex justify-end"><button className={buttonClass("primary")}>Publish message</button></div>
            </form>
          </ModalButton>
        }
      >
        {name}
      </Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          items={[
            { label: "Name", value: name },
            { label: "Display name", value: attrs.DisplayName || "-" },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{arn}</span> },
            { label: "Type", value: fifo ? "FIFO" : "Standard" },
            { label: "Topic owner", value: attrs.Owner ?? "000000000000" },
            { label: "Subscriptions confirmed", value: attrs.SubscriptionsConfirmed ?? String(subs.length) },
          ]}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={subs.length}
            actions={
              <>
                <ConfirmAction formId={FORM} action={unsubscribe} extra={{ topic: arn }} label="Delete" title="Delete subscription" noun="subscription" confirmWord="delete me" />
                <ModalButton label="Create subscription" title="Create subscription" variant="primary">
                  <form action={subscribe} className="space-y-4">
                    <input type="hidden" name="topic" value={arn} />
                    <FormField label="Protocol" description="The type of endpoint to subscribe.">
                      <Select name="protocol" defaultValue="sqs">
                        {["sqs", "lambda", "http", "https", "email", "email-json", "sms"].map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Endpoint" description="For SQS and Lambda, enter the ARN of the queue or function.">
                      <Input name="endpoint" required placeholder="arn:aws:sqs:us-east-1:000000000000:my-queue" />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create subscription</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Subscriptions
          </Header>
        }
      >
        <form id={FORM} />
        <Table
          formId={FORM}
          selection="single"
          rows={subs}
          rowKey={(s) => s.SubscriptionArn!}
          columns={[
            { header: "ID", cell: (s) => <span className="font-mono text-[13px]">{s.SubscriptionArn?.split(":").pop()}</span> },
            { header: "Endpoint", cell: (s) => <span className="break-all">{s.Endpoint}</span> },
            { header: "Status", cell: (s) => (s.SubscriptionArn === "PendingConfirmation" ? <StatusIndicator type="pending">Pending confirmation</StatusIndicator> : <StatusIndicator type="success">Confirmed</StatusIndicator>) },
            { header: "Protocol", cell: (s) => s.Protocol?.toUpperCase() },
          ]}
          empty={<EmptyState title="No subscriptions found" description="You don't have any subscriptions to this topic." />}
        />
      </Container>
    </Page>
  );
}
