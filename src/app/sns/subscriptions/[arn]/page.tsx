import { GetSubscriptionAttributesCommand } from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, ErrorAlert, FormField, Header, Input, KeyValue, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { deleteSubscriptions, editSubscription } from "../../actions";

const pretty = (s?: string) => {
  if (!s) return "";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
};

export default async function SubscriptionPage({ params }: PageProps<"/sns/subscriptions/[arn]">) {
  const arn = decodeURIComponent((await params).arn);
  const id = arn.split(":").pop()!;
  let a: Record<string, string> = {};
  try {
    const { sns } = await aws();
    a = (await sns.send(new GetSubscriptionAttributesCommand({ SubscriptionArn: arn }))).Attributes ?? {};
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">Subscription: {id}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const redrive = (() => {
    try {
      return a.RedrivePolicy ? (JSON.parse(a.RedrivePolicy) as { deadLetterTargetArn?: string }) : null;
    } catch {
      return null;
    }
  })();
  const rawAllowed = !["lambda", "email", "email-json", "sms"].includes(a.Protocol ?? "");
  const pending = a.PendingConfirmation === "true";
  return (
    <Page>
      <Header
        variant="h1"
        actions={
          <>
            <ConfirmAction action={deleteSubscriptions} values={[arn]} extra={{ redirect: "1" }} label="Delete" title="Delete subscription" noun="subscription" confirmWord="delete me" />
            <ModalButton label="Edit" title="Edit subscription" variant="primary" size="lg">
              <form action={editSubscription} className="space-y-4">
                <input type="hidden" name="subscription" value={arn} />
                {rawAllowed && <input type="hidden" name="rawAllowed" value="1" />}
                {a.FilterPolicy && <input type="hidden" name="hadFilter" value="1" />}
                {redrive && <input type="hidden" name="hadDlq" value="1" />}
                {rawAllowed && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="raw" defaultChecked={a.RawMessageDelivery === "true"} className="accent-accent" /> Enable raw message delivery
                  </label>
                )}
                <FormField label="Subscription filter policy" description="Only messages matching the policy are delivered. Leave empty to deliver all messages.">
                  <Select name="scope" defaultValue={a.FilterPolicyScope ?? "MessageAttributes"} className="mb-2">
                    <option value="MessageAttributes">Message attributes</option>
                    <option value="MessageBody">Message body</option>
                  </Select>
                  <Textarea name="filter" rows={10} spellCheck={false} defaultValue={pretty(a.FilterPolicy)} placeholder={'{\n  "color": ["blue", "green"]\n}'} />
                </FormField>
                <FormField label="Redrive policy (dead-letter queue)" description="ARN of an SQS queue for messages that can't be delivered. Leave empty to disable.">
                  <Input name="dlq" defaultValue={redrive?.deadLetterTargetArn ?? ""} placeholder="arn:aws:sqs:us-east-1:000000000000:my-dlq" />
                </FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
              </form>
            </ModalButton>
          </>
        }
      >
        Subscription: {id}
      </Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          items={[
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{arn}</span> },
            { label: "Endpoint", value: <span className="break-all">{a.Endpoint}</span> },
            { label: "Topic", value: <a className="text-accent hover:underline" href={`/sns/topics/${encodeURIComponent(a.TopicArn ?? "")}`}>{a.TopicArn?.split(":").pop()}</a> },
            { label: "Protocol", value: a.Protocol?.toUpperCase() },
            { label: "Status", value: pending ? <StatusIndicator type="pending">Pending confirmation</StatusIndicator> : <StatusIndicator type="success">Confirmed</StatusIndicator> },
            { label: "Confirmed by", value: a.ConfirmationWasAuthenticated === "true" ? "Authenticated request" : "Unauthenticated request" },
            { label: "Raw message delivery", value: rawAllowed ? (a.RawMessageDelivery === "true" ? "Enabled" : "Disabled") : "Not applicable" },
            { label: "Filter policy scope", value: a.FilterPolicy ? (a.FilterPolicyScope ?? "MessageAttributes") : "-" },
            { label: "Dead-letter queue", value: redrive?.deadLetterTargetArn?.split(":").pop() ?? "Disabled" },
          ]}
        />
      </Container>
      <Container header={<Header description="Messages that don't match are not delivered to this endpoint.">Subscription filter policy</Header>}>
        <pre className="max-h-96 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap">{pretty(a.FilterPolicy) || "No filter policy. All messages are delivered."}</pre>
      </Container>
    </Page>
  );
}
