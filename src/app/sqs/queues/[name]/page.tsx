import { GetQueueAttributesCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Container, ErrorAlert, Header, KeyValue, LinkButton } from "@/components/ui";
import { MessagesPanel } from "../../messages-panel";

export default async function QueuePage({ params, searchParams }: PageProps<"/sqs/queues/[name]">) {
  const name = decodeURIComponent((await params).name);
  const tab = (await searchParams).tab === "messages" ? "messages" : "details";
  let url = "";
  let a: Record<string, string> = {};
  try {
    const { sqs } = await aws();
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
  const base = `/sqs/queues/${encodeURIComponent(name)}`;
  return (
    <Page>
      <Header variant="h1" actions={<LinkButton href={`${base}?tab=messages`} variant="primary">Send and receive messages</LinkButton>}>
        {name}
      </Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          items={[
            { label: "Name", value: name },
            { label: "Type", value: a.FifoQueue === "true" ? "FIFO" : "Standard" },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{a.QueueArn}</span> },
            { label: "URL", value: <span className="font-mono text-[13px] break-all">{url}</span> },
            { label: "Created", value: formatDate(a.CreatedTimestamp) },
            { label: "Last updated", value: formatDate(a.LastModifiedTimestamp) },
            { label: "Maximum message size", value: a.MaximumMessageSize ? `${Number(a.MaximumMessageSize) / 1024} KB` : "-" },
            { label: "Message retention period", value: a.MessageRetentionPeriod ? `${Math.round(Number(a.MessageRetentionPeriod) / 86400)} Days` : "-" },
            { label: "Default visibility timeout", value: a.VisibilityTimeout ? `${a.VisibilityTimeout} Seconds` : "-" },
            { label: "Messages available", value: a.ApproximateNumberOfMessages ?? "0" },
            { label: "Messages in flight", value: a.ApproximateNumberOfMessagesNotVisible ?? "0" },
            { label: "Delivery delay", value: `${a.DelaySeconds ?? 0} Seconds` },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "details", label: "Overview" }, { id: "messages", label: "Send and receive messages" }]} />
      {tab === "messages" ? (
        <Container header={<Header>Send and receive messages</Header>}>
          <MessagesPanel name={name} />
        </Container>
      ) : (
        <Container header={<Header>Access policy</Header>}>
          <pre className="max-h-80 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap">{a.Policy ? JSON.stringify(JSON.parse(a.Policy), null, 2) : "No access policy."}</pre>
        </Container>
      )}
    </Page>
  );
}
