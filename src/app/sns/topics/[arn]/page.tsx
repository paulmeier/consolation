import {
  GetDataProtectionPolicyCommand,
  GetTopicAttributesCommand,
  ListSubscriptionsByTopicCommand,
  ListTagsForResourceCommand,
  type Subscription,
  type Tag,
} from "@aws-sdk/client-sns";
import { aws, errorMessage, EMULATOR_ACCOUNT } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TagsPanel } from "@/components/tags";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { KeyValueEditor } from "@/components/client/kv-editor";
import { Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import {
  confirmSubscription,
  editTopic,
  publish,
  putDataProtection,
  setDeliveryLogging,
  setTopicEncryption,
  setTopicJson,
  subscribe,
  tagTopic,
  unsubscribe,
  untagTopic,
} from "../../actions";

const FORM = "subs-form";
const TABS = [
  { id: "subscriptions", label: "Subscriptions" },
  { id: "policy", label: "Access policy" },
  { id: "data-protection", label: "Data protection policy" },
  { id: "delivery", label: "Delivery policy (HTTP/S)" },
  { id: "logging", label: "Delivery status logging" },
  { id: "encryption", label: "Encryption" },
  { id: "tags", label: "Tags" },
];

const pretty = (s?: string) => {
  if (!s) return "";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
};

const DEFAULT_DELIVERY = {
  http: {
    defaultHealthyRetryPolicy: { minDelayTarget: 20, maxDelayTarget: 20, numRetries: 3, numMaxDelayRetries: 0, numNoDelayRetries: 0, numMinDelayRetries: 0, backoffFunction: "linear" },
    disableSubscriptionOverrides: false,
  },
};

const DEFAULT_DATA_PROTECTION = {
  Name: "data-protection-policy",
  Description: "",
  Version: "2021-06-01",
  Statement: [
    {
      Sid: "audit",
      DataDirection: "Inbound",
      Principal: ["*"],
      DataIdentifier: ["arn:aws:dataprotection::aws:data-identifier/EmailAddress"],
      Operation: { Audit: { SampleRate: "99", FindingsDestination: {} } },
    },
  ],
};

export default async function TopicPage({ params, searchParams }: PageProps<"/sns/topics/[arn]">) {
  const arn = decodeURIComponent((await params).arn);
  const t = String((await searchParams).tab ?? "subscriptions");
  const tab = TABS.some((x) => x.id === t) ? t : "subscriptions";
  const name = arn.split(":").pop()!;
  const { sns } = await aws();
  let attrs: Record<string, string> = {};
  let subs: Subscription[] = [];
  try {
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
  let tags: Tag[] = [];
  let dataProtection = "";
  let tabError: string | null = null;
  try {
    if (tab === "tags") tags = (await sns.send(new ListTagsForResourceCommand({ ResourceArn: arn }))).Tags ?? [];
    if (tab === "data-protection") dataProtection = (await sns.send(new GetDataProtectionPolicyCommand({ ResourceArn: arn }))).DataProtectionPolicy ?? "";
  } catch (e) {
    tabError = errorMessage(e);
  }
  const fifo = arn.endsWith(".fifo");
  const base = `/sns/topics/${encodeURIComponent(arn)}`;
  const hidden = <input type="hidden" name="topic" value={arn} />;
  const logged = ["Application", "HTTP", "Lambda", "SQS", "Firehose"].filter((p) => attrs[`${p}SuccessFeedbackRoleArn`] || attrs[`${p}FailureFeedbackRoleArn`]);

  function jsonPanel(title: string, attribute: string, current: string | undefined, fallback: object, description: string) {
    return (
      <Container
        header={
          <Header
            description={description}
            actions={
              <ModalButton label="Edit" title={title} size="lg">
                <form action={setTopicJson} className="space-y-4">
                  {hidden}
                  <input type="hidden" name="attribute" value={attribute} />
                  <FormField label="JSON" description="Leave empty to restore the default.">
                    <Textarea name="value" rows={16} spellCheck={false} defaultValue={pretty(current) || JSON.stringify(fallback, null, 2)} />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            {title}
          </Header>
        }
      >
        <pre className="max-h-96 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap">{pretty(current) || "Default (not set)."}</pre>
      </Container>
    );
  }

  let body: React.ReactNode = null;
  if (tab === "subscriptions") {
    body = (
      <Container
        noPadding
        header={
          <Header
            counter={subs.length}
            actions={
              <>
                <ConfirmAction formId={FORM} action={unsubscribe} extra={{ topic: arn }} label="Delete" title="Delete subscription" noun="subscription" confirmWord="delete me" />
                <ModalButton label="Confirm subscription" title="Confirm subscription">
                  <form action={confirmSubscription} className="space-y-4">
                    {hidden}
                    <p className="text-sm text-muted">Paste the token from the SubscriptionConfirmation message delivered to the endpoint.</p>
                    <FormField label="Token">
                      <Textarea name="token" rows={4} required />
                    </FormField>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="auth" className="accent-accent" /> Require authentication to unsubscribe
                    </label>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Confirm subscription</button></div>
                  </form>
                </ModalButton>
                <ModalButton label="Create subscription" title="Create subscription" variant="primary">
                  <form action={subscribe} className="space-y-4">
                    {hidden}
                    <FormField label="Protocol" description="The type of endpoint to subscribe.">
                      <Select name="protocol" defaultValue="sqs">
                        {["sqs", "lambda", "http", "https", "email", "email-json", "sms", "firehose", "application"].map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Endpoint" description="For SQS, Lambda, Firehose and application endpoints, enter the ARN.">
                      <Input name="endpoint" required placeholder="arn:aws:sqs:us-east-1:000000000000:my-queue" />
                    </FormField>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" name="allowQueue" defaultChecked className="mt-1 accent-accent" />
                      <span>For SQS: add a statement to the queue&apos;s access policy that lets this topic send to it. Without it, messages are not delivered.</span>
                    </label>
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
            {
              header: "ID",
              cell: (s) =>
                s.SubscriptionArn?.startsWith("arn:") ? (
                  <a className="font-mono text-[13px] text-accent hover:underline" href={`/sns/subscriptions/${encodeURIComponent(s.SubscriptionArn)}`}>{s.SubscriptionArn.split(":").pop()}</a>
                ) : (
                  <span className="font-mono text-[13px]">{s.SubscriptionArn}</span>
                ),
            },
            { header: "Endpoint", cell: (s) => <span className="break-all">{s.Endpoint}</span> },
            { header: "Status", cell: (s) => (s.SubscriptionArn === "PendingConfirmation" ? <StatusIndicator type="pending">Pending confirmation</StatusIndicator> : <StatusIndicator type="success">Confirmed</StatusIndicator>) },
            { header: "Protocol", cell: (s) => s.Protocol?.toUpperCase() },
          ]}
          empty={<EmptyState title="No subscriptions found" description="You don't have any subscriptions to this topic." />}
        />
      </Container>
    );
  } else if (tab === "policy") {
    body = jsonPanel("Access policy", "Policy", attrs.Policy, { Version: "2008-10-17", Id: "__default_policy_ID", Statement: [{ Sid: "__default_statement_ID", Effect: "Allow", Principal: { AWS: "*" }, Action: ["SNS:Publish", "SNS:Subscribe"], Resource: arn, Condition: { StringEquals: { "AWS:SourceOwner": EMULATOR_ACCOUNT } } }] }, "Who can publish and subscribe to this topic. Stored but not enforced by the emulator.");
  } else if (tab === "delivery") {
    body = jsonPanel("Delivery policy (HTTP/S)", "DeliveryPolicy", attrs.DeliveryPolicy, DEFAULT_DELIVERY, "Retry policy for HTTP and HTTPS subscriptions.");
  } else if (tab === "data-protection") {
    body = (
      <Container
        header={
          <Header
            description="Audit, de-identify or block sensitive data published to this topic."
            actions={
              <ModalButton label="Edit" title="Data protection policy" size="lg">
                <form action={putDataProtection} className="space-y-4">
                  {hidden}
                  <FormField label="JSON">
                    <Textarea name="value" rows={18} spellCheck={false} defaultValue={pretty(dataProtection) || JSON.stringify(DEFAULT_DATA_PROTECTION, null, 2)} />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            Data protection policy
          </Header>
        }
      >
        <pre className="max-h-96 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap">{pretty(dataProtection) || "No data protection policy."}</pre>
      </Container>
    );
  } else if (tab === "logging") {
    const first = logged[0];
    body = (
      <Container
        header={
          <Header
            description="Log delivery status of messages to CloudWatch Logs, per protocol."
            actions={
              <ModalButton label="Edit" title="Delivery status logging">
                <form action={setDeliveryLogging} className="space-y-4">
                  {hidden}
                  {logged.map((p) => <input key={p} type="hidden" name={`was-${p}`} value="1" />)}
                  <fieldset className="space-y-1">
                    <legend className="mb-1 text-sm font-bold">Protocols</legend>
                    {["Application", "HTTP", "Lambda", "SQS", "Firehose"].map((p) => (
                      <label key={p} className="mr-4 inline-flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name={`log-${p}`} defaultChecked={logged.includes(p)} className="accent-accent" /> {p === "HTTP" ? "HTTP/S" : p === "SQS" ? "Amazon SQS" : p === "Lambda" ? "AWS Lambda" : p === "Firehose" ? "Amazon Data Firehose" : "Platform application endpoint"}
                      </label>
                    ))}
                  </fieldset>
                  <FormField label="Success sample rate (%)">
                    <Input name="sampleRate" type="number" min={0} max={100} defaultValue={first ? attrs[`${first}SuccessFeedbackSampleRate`] || "100" : "100"} />
                  </FormField>
                  <FormField label="IAM role for successful deliveries">
                    <Input name="successRole" required defaultValue={first ? attrs[`${first}SuccessFeedbackRoleArn`] : `arn:aws:iam::${EMULATOR_ACCOUNT}:role/SNSSuccessFeedback`} />
                  </FormField>
                  <FormField label="IAM role for failed deliveries">
                    <Input name="failureRole" required defaultValue={first ? attrs[`${first}FailureFeedbackRoleArn`] : `arn:aws:iam::${EMULATOR_ACCOUNT}:role/SNSFailureFeedback`} />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            Delivery status logging
          </Header>
        }
      >
        <KeyValue
          items={[
            { label: "Logging enabled for", value: logged.length ? logged.join(", ") : "None" },
            { label: "Success role", value: first ? attrs[`${first}SuccessFeedbackRoleArn`] || "-" : "-" },
            { label: "Failure role", value: first ? attrs[`${first}FailureFeedbackRoleArn`] || "-" : "-" },
            { label: "Success sample rate", value: first ? `${attrs[`${first}SuccessFeedbackSampleRate`] ?? "-"}%` : "-" },
          ]}
        />
      </Container>
    );
  } else if (tab === "encryption") {
    body = (
      <Container
        header={
          <Header
            description="Server-side encryption of published messages."
            actions={
              <ModalButton label="Edit" title="Encryption">
                <form action={setTopicEncryption} className="space-y-4">
                  {hidden}
                  <fieldset className="space-y-2">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" name="encryption" value="off" defaultChecked={!attrs.KmsMasterKeyId} className="accent-accent" /> Disable encryption</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" name="encryption" value="on" defaultChecked={!!attrs.KmsMasterKeyId} className="accent-accent" /> Enable encryption</label>
                  </fieldset>
                  <FormField label="AWS KMS key" description="Key ID, ARN or alias.">
                    <Input name="kmsKey" defaultValue={attrs.KmsMasterKeyId || "alias/aws/sns"} />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            Encryption
          </Header>
        }
      >
        <KeyValue
          items={[
            { label: "Encryption", value: attrs.KmsMasterKeyId ? <StatusIndicator type="success">Configured</StatusIndicator> : <StatusIndicator type="stopped">Not configured</StatusIndicator> },
            { label: "AWS KMS key", value: attrs.KmsMasterKeyId || "-" },
          ]}
        />
      </Container>
    );
  } else if (tab === "tags") {
    body = <TagsPanel tags={tags} addAction={tagTopic} removeAction={untagTopic} hidden={{ topic: arn }} />;
  }

  return (
    <Page>
      <Header
        variant="h1"
        actions={
          <>
            <ModalButton label="Edit" title={`Edit ${name}`}>
              <form action={editTopic} className="space-y-4">
                {hidden}
                <FormField label={<>Display name <i className="font-normal text-muted">- optional</i></>} constraint="Up to 100 characters. Used as the sender name for SMS.">
                  <Input name="display" maxLength={100} defaultValue={attrs.DisplayName ?? ""} />
                </FormField>
                {fifo && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="contentDedup" defaultChecked={attrs.ContentBasedDeduplication === "true"} className="accent-accent" /> Content-based message deduplication
                  </label>
                )}
                <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
              </form>
            </ModalButton>
            <ModalButton label="Publish message" title={`Publish message to ${name}`} variant="primary" size="lg">
              <form action={publish} className="space-y-4">
                {hidden}
                <FormField label={<>Subject <i className="font-normal text-muted">- optional</i></>}>
                  <Input name="subject" maxLength={100} placeholder="Enter a subject" />
                </FormField>
                {fifo && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Message group ID">
                      <Input name="group" defaultValue="default" required />
                    </FormField>
                    <FormField label={<>Message deduplication ID <i className="font-normal text-muted">- optional</i></>}>
                      <Input name="dedup" />
                    </FormField>
                  </div>
                )}
                <fieldset className="space-y-1">
                  <legend className="text-sm font-bold">Message structure</legend>
                  <label className="mr-4 inline-flex items-center gap-1.5 text-sm"><input type="radio" name="structure" value="identical" defaultChecked className="accent-accent" /> Identical payload for all delivery protocols</label>
                  <label className="inline-flex items-center gap-1.5 text-sm"><input type="radio" name="structure" value="json" className="accent-accent" /> Custom payload for each delivery protocol (JSON with a &quot;default&quot; key)</label>
                </fieldset>
                <FormField label="Message body" constraint="Maximum 256 KB.">
                  <Textarea name="message" rows={8} required />
                </FormField>
                <details className="rounded-lg border border-line p-3">
                  <summary className="cursor-pointer text-sm font-bold">Message attributes</summary>
                  <p className="my-2 text-sm text-muted">Numeric values are sent as Number, everything else as String. Subscription filter policies match on these.</p>
                  <KeyValueEditor name="attributes" />
                </details>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Publish message</button></div>
              </form>
            </ModalButton>
          </>
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
            { label: "Type", value: fifo ? <Badge color="blue">FIFO</Badge> : "Standard" },
            { label: "Topic owner", value: attrs.Owner ?? EMULATOR_ACCOUNT },
            { label: "Subscriptions", value: `${attrs.SubscriptionsConfirmed ?? subs.length} confirmed, ${attrs.SubscriptionsPending ?? 0} pending` },
            ...(fifo ? [{ label: "Content-based deduplication", value: attrs.ContentBasedDeduplication === "true" ? "Enabled" : "Disabled" }] : []),
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={TABS} />
      {tabError ? <ErrorAlert message={tabError} /> : body}
    </Page>
  );
}
