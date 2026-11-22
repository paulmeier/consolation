import {
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  ListDeadLetterSourceQueuesCommand,
  ListMessageMoveTasksCommand,
  ListQueueTagsCommand,
  ListQueuesCommand,
  type ListMessageMoveTasksResultEntry,
} from "@aws-sdk/client-sqs";
import { ListEventSourceMappingsCommand, ListFunctionsCommand, type EventSourceMappingConfiguration } from "@aws-sdk/client-lambda";
import { ListSubscriptionsCommand, ListTopicsCommand, type Subscription } from "@aws-sdk/client-sns";
import { aws, errorMessage, REGION, EMULATOR_ACCOUNT } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Table } from "@/components/table";
import { TagsPanel } from "@/components/tags";
import { ModalButton } from "@/components/client/modal";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Alert, Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { MessagesPanel } from "../../messages-panel";
import {
  addLambdaTrigger,
  addQueuePermission,
  cancelRedrive,
  deleteLambdaTriggers,
  removeQueuePermission,
  setQueuePolicy,
  setRedriveAllowPolicy,
  setRedrivePolicy,
  startRedrive,
  subscribeToTopic,
  tagQueue,
  toggleLambdaTrigger,
  unsubscribeQueue,
  untagQueue,
  updateEncryption,
  updateQueue,
} from "../../actions";

const TABS = [
  { id: "details", label: "Details" },
  { id: "messages", label: "Send and receive messages" },
  { id: "subscriptions", label: "SNS subscriptions" },
  { id: "triggers", label: "Lambda triggers" },
  { id: "dlq", label: "Dead-letter queue" },
  { id: "redrive", label: "Dead-letter queue redrive tasks" },
  { id: "policy", label: "Access policy" },
  { id: "encryption", label: "Encryption" },
  { id: "tags", label: "Tagging" },
];

const arnOf = (name: string) => `arn:aws:sqs:${REGION}:${EMULATOR_ACCOUNT}:${name}`;
const nameOfUrl = (u: string) => u.split("/").pop() ?? u;

function safeJson<T>(s?: string): T | null {
  try {
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function secs(n?: string) {
  const v = Number(n ?? 0);
  if (v >= 86400 && v % 86400 === 0) return `${v / 86400} Days`;
  if (v >= 3600 && v % 3600 === 0) return `${v / 3600} Hours`;
  if (v >= 60 && v % 60 === 0) return `${v / 60} Minutes`;
  return `${v} Seconds`;
}

export default async function QueuePage({ params, searchParams }: PageProps<"/sqs/queues/[name]">) {
  const name = decodeURIComponent((await params).name);
  const t = String((await searchParams).tab ?? "details");
  const tab = TABS.some((x) => x.id === t) ? t : "details";
  let url = "";
  let a: Record<string, string> = {};
  const { sqs, lambda, sns } = await aws();
  try {
    url = (await sqs.send(new GetQueueUrlCommand({ QueueName: name }))).QueueUrl!;
    a = (await sqs.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ["All"] }))).Attributes ?? {};
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const fifo = a.FifoQueue === "true";
  const arn = a.QueueArn ?? arnOf(name);
  const base = `/sqs/queues/${encodeURIComponent(name)}`;
  const hidden = <input type="hidden" name="name" value={name} />;
  const redrive = safeJson<{ deadLetterTargetArn: string; maxReceiveCount: number | string }>(a.RedrivePolicy);
  const allow = safeJson<{ redrivePermission: string; sourceQueueArns?: string[] }>(a.RedriveAllowPolicy);
  const encryption = a.KmsMasterKeyId ? "kms" : a.SqsManagedSseEnabled === "true" ? "sqs" : "none";

  const d: {
    subs: Subscription[];
    topics: { TopicArn?: string }[];
    maps: EventSourceMappingConfiguration[];
    fns: { FunctionArn?: string; FunctionName?: string }[];
    queues: string[];
    sources: string[];
    tasks: ListMessageMoveTasksResultEntry[];
    tags: Record<string, string>;
  } = { subs: [], topics: [], maps: [], fns: [], queues: [], sources: [], tasks: [], tags: {} };
  let tabError: string | null = null;
  try {
    if (tab === "subscriptions") {
      let token: string | undefined;
      do {
        const r = await sns.send(new ListSubscriptionsCommand({ NextToken: token }));
        d.subs.push(...(r.Subscriptions ?? []).filter((s) => s.Endpoint === arn));
        token = r.NextToken;
      } while (token);
      d.topics = (await sns.send(new ListTopicsCommand({}))).Topics ?? [];
    } else if (tab === "triggers") {
      d.maps = (await lambda.send(new ListEventSourceMappingsCommand({ EventSourceArn: arn }))).EventSourceMappings ?? [];
      d.fns = (await lambda.send(new ListFunctionsCommand({}))).Functions ?? [];
    } else if (tab === "dlq" || tab === "redrive") {
      d.queues = ((await sqs.send(new ListQueuesCommand({ MaxResults: 1000 }))).QueueUrls ?? []).map(nameOfUrl).filter((n) => n !== name);
      if (tab === "dlq") d.sources = (await sqs.send(new ListDeadLetterSourceQueuesCommand({ QueueUrl: url }))).queueUrls ?? [];
      else d.tasks = (await sqs.send(new ListMessageMoveTasksCommand({ SourceArn: arn, MaxResults: 10 }))).Results ?? [];
    } else if (tab === "tags") {
      d.tags = (await sqs.send(new ListQueueTagsCommand({ QueueUrl: url }))).Tags ?? {};
    }
  } catch (e) {
    tabError = errorMessage(e);
  }

  let body: React.ReactNode = null;
  {
    if (tab === "details") {
      body = (
        <Container header={<Header>More</Header>}>
          <KeyValue
            items={[
              { label: "Maximum message size", value: a.MaximumMessageSize ? `${Number(a.MaximumMessageSize) / 1024} KB` : "-" },
              { label: "Message retention period", value: secs(a.MessageRetentionPeriod) },
              { label: "Default visibility timeout", value: secs(a.VisibilityTimeout) },
              { label: "Delivery delay", value: secs(a.DelaySeconds) },
              { label: "Receive message wait time", value: secs(a.ReceiveMessageWaitTimeSeconds) },
              { label: "Messages available", value: a.ApproximateNumberOfMessages ?? "0" },
              { label: "Messages in flight", value: a.ApproximateNumberOfMessagesNotVisible ?? "0" },
              { label: "Messages delayed", value: a.ApproximateNumberOfMessagesDelayed ?? "0" },
              { label: "Dead-letter queue", value: redrive ? nameOfUrl(redrive.deadLetterTargetArn.split(":").pop() ?? "") : "Disabled" },
              { label: "Encryption", value: encryption === "kms" ? `SSE-KMS (${a.KmsMasterKeyId})` : encryption === "sqs" ? "Amazon SQS key (SSE-SQS)" : "Disabled" },
              ...(fifo
                ? [
                    { label: "Content-based deduplication", value: a.ContentBasedDeduplication === "true" ? "Enabled" : "Disabled" },
                    { label: "Deduplication scope", value: a.DeduplicationScope ?? "queue" },
                    { label: "FIFO throughput limit", value: a.FifoThroughputLimit ?? "perQueue" },
                  ]
                : []),
            ]}
          />
        </Container>
      );
    } else if (tab === "messages") {
      body = (
        <Container header={<Header>Send and receive messages</Header>}>
          <MessagesPanel name={name} />
        </Container>
      );
    } else if (tab === "subscriptions") {
      const { subs, topics } = d;
      body = (
        <Container
          noPadding
          header={
            <Header
              counter={subs.length}
              description="Amazon SNS topics that deliver messages to this queue."
              actions={
                <>
                  <ConfirmAction formId="subs-form" action={unsubscribeQueue} extra={{ name }} label="Unsubscribe" title="Delete subscriptions" noun="subscription" />
                  <ModalButton label="Subscribe to Amazon SNS topic" title="Subscribe to Amazon SNS topic" variant="primary">
                    <form action={subscribeToTopic} className="space-y-4">
                      {hidden}
                      <input type="hidden" name="queueArn" value={arn} />
                      <FormField label="Amazon SNS topic" description="Messages published to the topic are sent to this queue.">
                        <Select name="topicArn" required>
                          {topics.map((tp) => (
                            <option key={tp.TopicArn} value={tp.TopicArn}>{tp.TopicArn?.split(":").pop()}</option>
                          ))}
                        </Select>
                      </FormField>
                      {topics.length === 0 && <p className="text-sm text-muted">No topics. Create one in Amazon SNS first.</p>}
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="raw" className="accent-accent" /> Enable raw message delivery
                      </label>
                      <p className="text-sm text-muted">The queue&apos;s access policy is updated to allow the topic to send messages to it.</p>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={topics.length === 0}>Save</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              SNS subscriptions
            </Header>
          }
        >
          <form id="subs-form" />
          <Table
            formId="subs-form"
            selection="multi"
            rows={subs}
            rowKey={(s) => s.SubscriptionArn ?? ""}
            columns={[
              { header: "Subscription ARN", cell: (s) => <span className="font-mono text-[13px] break-all">{s.SubscriptionArn}</span> },
              { header: "Topic", cell: (s) => <a className="text-accent hover:underline" href={`/sns/topics/${encodeURIComponent(s.TopicArn ?? "")}`}>{s.TopicArn?.split(":").pop()}</a> },
            ]}
            empty={<EmptyState title="No subscriptions" description="This queue is not subscribed to any Amazon SNS topics." />}
          />
        </Container>
      );
    } else if (tab === "triggers") {
      const { maps, fns } = d;
      body = (
        <Container
          noPadding
          header={
            <Header
              counter={maps.length}
              description="Lambda functions that poll this queue through event source mappings."
              actions={
                <>
                  <ConfirmAction formId="trig-form" action={deleteLambdaTriggers} extra={{ name }} label="Delete" title="Delete triggers" noun="trigger" />
                  <button form="trig-form" className={`${buttonClass("normal")} needs-selection`} name="enable" value="false">Disable</button>
                  <button form="trig-form" className={`${buttonClass("normal")} needs-selection`} name="enable" value="true">Enable</button>
                  <ModalButton label="Configure Lambda function trigger" title="Configure Lambda function trigger" variant="primary">
                    <form action={addLambdaTrigger} className="space-y-4">
                      {hidden}
                      <input type="hidden" name="queueArn" value={arn} />
                      <FormField label="Lambda function">
                        <Select name="function" required>
                          {fns.map((f) => <option key={f.FunctionArn} value={f.FunctionName}>{f.FunctionName}</option>)}
                        </Select>
                      </FormField>
                      {fns.length === 0 && <p className="text-sm text-muted">No functions. Create one in AWS Lambda first.</p>}
                      <FormField label="Batch size" constraint="1 to 10 for FIFO queues, up to 10,000 for standard queues.">
                        <Input name="batchSize" type="number" min={1} max={10000} defaultValue={10} />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={fns.length === 0}>Save</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Lambda triggers
            </Header>
          }
        >
          <form id="trig-form" action={toggleLambdaTrigger}>{hidden}</form>
          <Table
            formId="trig-form"
            selection="multi"
            rows={maps}
            rowKey={(m) => m.UUID ?? ""}
            columns={[
              { header: "Function", cell: (m) => <a className="text-accent hover:underline" href={`/lambda/functions/${encodeURIComponent(m.FunctionArn?.split(":").pop() ?? "")}`}>{m.FunctionArn?.split(":").pop()}</a> },
              { header: "UUID", cell: (m) => <span className="font-mono text-[13px]">{m.UUID}</span> },
              { header: "Batch size", cell: (m) => m.BatchSize },
              { header: "Status", cell: (m) => <StatusIndicator type={m.State === "Enabled" ? "success" : m.State === "Disabled" ? "stopped" : "pending"}>{m.State}</StatusIndicator> },
              { header: "Last modified", cell: (m) => formatDate(m.LastModified) },
            ]}
            empty={<EmptyState title="No triggers" description="No Lambda functions are triggered by this queue." />}
          />
        </Container>
      );
    } else if (tab === "dlq") {
      const candidates = d.queues.filter((n) => n.endsWith(".fifo") === fifo);
      const sources = d.sources;
      body = (
        <>
          <Container
            header={
              <Header
                description="Messages that can't be processed after the maximum receives are moved to the dead-letter queue."
                actions={
                  <ModalButton label="Edit" title="Dead-letter queue">
                    <form action={setRedrivePolicy} className="space-y-4">
                      {hidden}
                      <FormField label="Dead-letter queue" description={`Choose a ${fifo ? "FIFO" : "standard"} queue, or Disabled.`}>
                        <Select name="dlqArn" defaultValue={redrive?.deadLetterTargetArn ?? ""}>
                          <option value="">Disabled</option>
                          {candidates.map((n) => <option key={n} value={arnOf(n)}>{n}</option>)}
                        </Select>
                      </FormField>
                      <FormField label="Maximum receives" constraint="1 to 1,000">
                        <Input name="maxReceiveCount" type="number" min={1} max={1000} defaultValue={String(redrive?.maxReceiveCount ?? 10)} />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                    </form>
                  </ModalButton>
                }
              >
                Dead-letter queue
              </Header>
            }
          >
            <KeyValue
              items={[
                { label: "Status", value: redrive ? <StatusIndicator type="success">Enabled</StatusIndicator> : <StatusIndicator type="stopped">Disabled</StatusIndicator> },
                { label: "Queue", value: redrive ? <a className="text-accent hover:underline" href={`/sqs/queues/${encodeURIComponent(redrive.deadLetterTargetArn.split(":").pop() ?? "")}`}>{redrive.deadLetterTargetArn.split(":").pop()}</a> : "-" },
                { label: "Maximum receives", value: redrive ? String(redrive.maxReceiveCount) : "-" },
              ]}
            />
          </Container>
          <Container
            header={
              <Header
                description="Which source queues can use this queue as their dead-letter queue."
                actions={
                  <ModalButton label="Edit" title="Redrive allow policy">
                    <form action={setRedriveAllowPolicy} className="space-y-4">
                      {hidden}
                      <FormField label="Redrive permission">
                        <Select name="permission" defaultValue={allow?.redrivePermission ?? "allowAll"}>
                          <option value="allowAll">Allow all</option>
                          <option value="byQueue">By queue</option>
                          <option value="denyAll">Deny all</option>
                        </Select>
                      </FormField>
                      <FormField label="Source queue ARNs" description="Used with By queue. Up to 10, one per line.">
                        <Textarea name="sourceArns" rows={3} defaultValue={(allow?.sourceQueueArns ?? []).join("\n")} />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                    </form>
                  </ModalButton>
                }
              >
                Redrive allow policy
              </Header>
            }
          >
            <KeyValue
              items={[
                { label: "Redrive permission", value: allow?.redrivePermission ?? "allowAll" },
                { label: "Source queues", value: allow?.sourceQueueArns?.length ? allow.sourceQueueArns.map((s) => s.split(":").pop()).join(", ") : "-" },
                { label: "Queues using this as a DLQ", value: sources.length ? sources.map(nameOfUrl).join(", ") : "None" },
              ]}
            />
          </Container>
        </>
      );
    } else if (tab === "redrive") {
      const tasks = d.tasks;
      const others = d.queues;
      const running = tasks.find((x) => x.Status === "RUNNING");
      body = (
        <Container
          noPadding
          header={
            <Header
              counter={tasks.length}
              description="Move messages from this dead-letter queue back to their source queues or to another queue."
              actions={
                <>
                  {running && (
                    <form action={cancelRedrive}>
                      {hidden}
                      <input type="hidden" name="handle" value={running.TaskHandle} />
                      <button className={buttonClass("normal")}>Cancel redrive</button>
                    </form>
                  )}
                  <ModalButton label="Start DLQ redrive" title="Start DLQ redrive" variant="primary">
                    <form action={startRedrive} className="space-y-4">
                      {hidden}
                      <input type="hidden" name="sourceArn" value={arn} />
                      <FormField label="Redrive destination">
                        <Select name="destinationArn" defaultValue="">
                          <option value="">Redrive to source queue(s)</option>
                          {others.map((n) => <option key={n} value={arnOf(n)}>{n}</option>)}
                        </Select>
                      </FormField>
                      <FormField label={<>Velocity control <i className="font-normal text-muted">- optional</i></>} constraint="Maximum messages per second, 1 to 500. Leave empty for system optimized.">
                        <Input name="rate" type="number" min={1} max={500} />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>DLQ redrive</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Dead-letter queue redrive tasks
            </Header>
          }
        >
          <Table
            rows={tasks}
            rowKey={(x) => x.TaskHandle ?? String(x.StartedTimestamp)}
            columns={[
              { header: "Status", cell: (x) => <StatusIndicator type={x.Status === "COMPLETED" ? "success" : x.Status === "RUNNING" ? "pending" : x.Status === "FAILED" ? "error" : "stopped"}>{x.Status}</StatusIndicator> },
              { header: "Destination", cell: (x) => x.DestinationArn?.split(":").pop() ?? "Source queue(s)" },
              { header: "Messages moved", cell: (x) => `${x.ApproximateNumberOfMessagesMoved ?? 0} / ${x.ApproximateNumberOfMessagesToMove ?? "-"}` },
              { header: "Started", cell: (x) => formatDate(x.StartedTimestamp) },
              { header: "Failure reason", cell: (x) => x.FailureReason ?? "-" },
            ]}
            empty={<EmptyState title="No redrive tasks" description="Start a DLQ redrive to move messages out of this queue." />}
          />
        </Container>
      );
    } else if (tab === "policy") {
      const policy = safeJson<{ Statement?: { Sid?: string; Principal?: unknown; Action?: unknown; Effect?: string }[] }>(a.Policy);
      const statements = policy?.Statement ?? [];
      body = (
        <>
          <Container
            header={
              <Header
                description="Who can access this queue (a resource-based policy). The emulator stores it but does not enforce it."
                actions={
                  <ModalButton label="Edit" title="Access policy" size="lg">
                    <form action={setQueuePolicy} className="space-y-4">
                      {hidden}
                      <FormField label="Policy JSON" description="Leave empty to remove the policy.">
                        <Textarea
                          name="policy"
                          rows={16}
                          spellCheck={false}
                          defaultValue={
                            a.Policy
                              ? JSON.stringify(JSON.parse(a.Policy), null, 2)
                              : JSON.stringify(
                                  { Version: "2012-10-17", Statement: [{ Sid: "__owner_statement", Effect: "Allow", Principal: { AWS: `arn:aws:iam::${EMULATOR_ACCOUNT}:root` }, Action: "SQS:*", Resource: arn }] },
                                  null,
                                  2,
                                )
                          }
                        />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                    </form>
                  </ModalButton>
                }
              >
                Access policy
              </Header>
            }
          >
            <pre className="max-h-96 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap">{a.Policy ? JSON.stringify(JSON.parse(a.Policy), null, 2) : "No access policy."}</pre>
          </Container>
          <Container
            noPadding
            header={
              <Header
                counter={statements.length}
                description="Permissions added with AddPermission appear as labelled policy statements."
                actions={
                  <>
                    <ConfirmAction formId="perm-form" action={removeQueuePermission} extra={{ name }} label="Remove" title="Remove permissions" noun="permission" confirmWord="remove" confirmLabel="Remove" />
                    <ModalButton label="Add permission" title="Add permission">
                      <form action={addQueuePermission} className="space-y-4">
                        {hidden}
                        <FormField label="Label" constraint="Unique per queue.">
                          <Input name="label" required pattern="[A-Za-z0-9_\-]{1,80}" />
                        </FormField>
                        <FormField label="AWS account IDs" description="Comma separated.">
                          <Input name="accounts" required defaultValue={EMULATOR_ACCOUNT} />
                        </FormField>
                        <fieldset className="space-y-1">
                          <legend className="text-sm font-bold">Actions</legend>
                          {["SendMessage", "ReceiveMessage", "DeleteMessage", "ChangeMessageVisibility", "GetQueueAttributes", "GetQueueUrl", "*"].map((x) => (
                            <label key={x} className="mr-4 inline-flex items-center gap-1.5 text-sm">
                              <input type="checkbox" name="actions" value={x} defaultChecked={x === "SendMessage"} className="accent-accent" /> {x === "*" ? "All SQS actions" : x}
                            </label>
                          ))}
                        </fieldset>
                        <div className="flex justify-end"><button className={buttonClass("primary")}>Add permission</button></div>
                      </form>
                    </ModalButton>
                  </>
                }
              >
                Permissions
              </Header>
            }
          >
            <form id="perm-form" />
            <Table
              formId="perm-form"
              selection="multi"
              rows={statements.filter((s) => s.Sid)}
              rowKey={(s) => s.Sid ?? ""}
              columns={[
                { header: "Label (Sid)", cell: (s) => s.Sid },
                { header: "Effect", cell: (s) => s.Effect },
                { header: "Principal", cell: (s) => <span className="font-mono text-[13px] break-all">{JSON.stringify(s.Principal)}</span> },
                { header: "Actions", cell: (s) => <span className="font-mono text-[13px] break-all">{([] as unknown[]).concat(s.Action ?? []).join(", ")}</span> },
              ]}
              empty={<EmptyState title="No permissions" />}
            />
          </Container>
        </>
      );
    } else if (tab === "encryption") {
      body = (
        <Container
          header={
            <Header
              description="Server-side encryption of messages at rest."
              actions={
                <ModalButton label="Edit" title="Encryption">
                  <form action={updateEncryption} className="space-y-4">
                    {hidden}
                    <fieldset className="space-y-2">
                      <legend className="mb-1 text-sm font-bold">Server-side encryption</legend>
                      {[
                        ["none", "Disabled"],
                        ["sqs", "Amazon SQS key (SSE-SQS)"],
                        ["kms", "AWS Key Management Service key (SSE-KMS)"],
                      ].map(([v, l]) => (
                        <label key={v} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="encryption" value={v} defaultChecked={encryption === v} className="accent-accent" /> {l}
                        </label>
                      ))}
                    </fieldset>
                    <FormField label="KMS key" description="Key ID, ARN or alias. Used with SSE-KMS.">
                      <Input name="kmsKey" defaultValue={a.KmsMasterKeyId ?? "alias/aws/sqs"} />
                    </FormField>
                    <FormField label="Data key reuse period (seconds)" constraint="60 to 86,400">
                      <Input name="reuse" type="number" min={60} max={86400} defaultValue={a.KmsDataKeyReusePeriodSeconds ?? "300"} />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
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
              { label: "Server-side encryption", value: encryption === "none" ? <StatusIndicator type="stopped">Disabled</StatusIndicator> : <StatusIndicator type="success">Enabled</StatusIndicator> },
              { label: "Encryption key type", value: encryption === "kms" ? "SSE-KMS" : encryption === "sqs" ? "SSE-SQS" : "-" },
              { label: "KMS key", value: a.KmsMasterKeyId ?? "-" },
              { label: "Data key reuse period", value: a.KmsDataKeyReusePeriodSeconds ? secs(a.KmsDataKeyReusePeriodSeconds) : "-" },
            ]}
          />
        </Container>
      );
    } else if (tab === "tags") {
      body = <TagsPanel tags={Object.entries(d.tags).map(([Key, Value]) => ({ Key, Value }))} addAction={tagQueue} removeAction={untagQueue} hidden={{ name }} />;
    }
  }

  return (
    <Page>
      <Header
        variant="h1"
        actions={
          <>
            <ModalButton label="Edit" title={`Edit ${name}`}>
              <form action={updateQueue} className="space-y-4">
                {hidden}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Visibility timeout (seconds)" constraint="0 to 43,200">
                    <Input name="visibility" type="number" min={0} max={43200} defaultValue={a.VisibilityTimeout} />
                  </FormField>
                  <FormField label="Message retention period (days)" constraint="1 minute to 14 days">
                    <Input name="retention" type="number" min={0.0007} max={14} step="any" defaultValue={String(Number(a.MessageRetentionPeriod ?? 345600) / 86400)} />
                  </FormField>
                  <FormField label="Delivery delay (seconds)" constraint="0 to 900">
                    <Input name="delay" type="number" min={0} max={900} defaultValue={a.DelaySeconds ?? "0"} />
                  </FormField>
                  <FormField label="Maximum message size (KB)" constraint="1 to 1,024">
                    <Input name="maxSize" type="number" min={1} max={1024} defaultValue={String(Number(a.MaximumMessageSize ?? 262144) / 1024)} />
                  </FormField>
                  <FormField label="Receive message wait time (seconds)" constraint="0 to 20">
                    <Input name="wait" type="number" min={0} max={20} defaultValue={a.ReceiveMessageWaitTimeSeconds ?? "0"} />
                  </FormField>
                </div>
                {fifo && (
                  <div className="space-y-4 border-t border-line pt-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="contentDedup" defaultChecked={a.ContentBasedDeduplication === "true"} className="accent-accent" /> Content-based deduplication
                    </label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="Deduplication scope">
                        <Select name="dedupScope" defaultValue={a.DeduplicationScope ?? "queue"}>
                          <option value="queue">Queue</option>
                          <option value="messageGroup">Message group</option>
                        </Select>
                      </FormField>
                      <FormField label="FIFO throughput limit">
                        <Select name="throughputLimit" defaultValue={a.FifoThroughputLimit ?? "perQueue"}>
                          <option value="perQueue">Per queue</option>
                          <option value="perMessageGroupId">Per message group ID</option>
                        </Select>
                      </FormField>
                    </div>
                  </div>
                )}
                <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
              </form>
            </ModalButton>
            <LinkButton href={`${base}?tab=messages`} variant="primary">Send and receive messages</LinkButton>
          </>
        }
      >
        {name}
      </Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          items={[
            { label: "Name", value: name },
            { label: "Type", value: fifo ? <Badge color="blue">FIFO</Badge> : "Standard" },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{arn}</span> },
            { label: "URL", value: <span className="font-mono text-[13px] break-all">{url}</span> },
            { label: "Created", value: formatDate(a.CreatedTimestamp) },
            { label: "Last updated", value: formatDate(a.LastModifiedTimestamp) },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={TABS} />
      {tabError ? <ErrorAlert message={tabError} /> : body}
      {tab === "triggers" && <Alert>The emulator records event source mappings; whether it invokes the function for new messages depends on the emulator build.</Alert>}
    </Page>
  );
}
