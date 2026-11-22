"use server";

import { revalidatePath } from "next/cache";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  GetQueueUrlCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SetQueueAttributesCommand,
  StartMessageMoveTaskCommand,
  CancelMessageMoveTaskCommand,
  TagQueueCommand,
  UntagQueueCommand,
  AddPermissionCommand,
  RemovePermissionCommand,
  type MessageAttributeValue,
} from "@aws-sdk/client-sqs";
import { CreateEventSourceMappingCommand, DeleteEventSourceMappingCommand, UpdateEventSourceMappingCommand } from "@aws-sdk/client-lambda";
import { SubscribeCommand, UnsubscribeCommand } from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";
import { guard, kvMap, parseJson } from "@/lib/guard";
import { allowTopicToSendToQueue } from "@/lib/sqs-policy";

const qp = (name: string) => `/sqs/queues/${encodeURIComponent(name)}`;

async function urlOf(name: string) {
  const { sqs } = await aws();
  return (await sqs.send(new GetQueueUrlCommand({ QueueName: name }))).QueueUrl!;
}

export async function createQueue(fd: FormData) {
  let name = String(fd.get("name") ?? "").trim();
  const fifo = fd.get("type") === "fifo";
  if (fifo && !name.endsWith(".fifo")) name += ".fifo";
  try {
    const { sqs } = await aws();
    const attrs: Record<string, string> = { VisibilityTimeout: String(fd.get("visibility") || "30") };
    if (fifo) {
      attrs.FifoQueue = "true";
      attrs.ContentBasedDeduplication = "true";
    }
    await sqs.send(new CreateQueueCommand({ QueueName: name, Attributes: attrs }));
    await flash("success", `Queue ${name} created successfully.`);
  } catch (e) {
    await flash("error", `Failed to create queue ${name}. ${errorMessage(e)}`);
  }
  revalidatePath("/sqs/queues");
}

export async function deleteQueues(fd: FormData) {
  const { sqs } = await aws();
  for (const n of fd.getAll("selected").map(String)) {
    try {
      await sqs.send(new DeleteQueueCommand({ QueueUrl: await urlOf(n) }));
      await flash("success", `Queue ${n} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete queue ${n}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/sqs/queues");
}

export async function purgeQueues(fd: FormData) {
  const { sqs } = await aws();
  for (const n of fd.getAll("selected").map(String)) {
    try {
      await sqs.send(new PurgeQueueCommand({ QueueUrl: await urlOf(n) }));
      await flash("success", `Purged queue ${n}.`);
    } catch (e) {
      await flash("error", `Failed to purge queue ${n}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/sqs/queues");
  for (const n of fd.getAll("selected").map(String)) revalidatePath(`/sqs/queues/${encodeURIComponent(n)}`);
}

export type SqsResult = {
  sent?: string;
  error?: string;
  messages?: {
    id: string;
    body: string;
    receipt: string;
    sentAt?: string;
    receiveCount?: string;
    md5?: string;
    attributes: Record<string, string>;
    system: Record<string, string>;
  }[];
  polledAt?: number;
} | null;

export async function sendMessage(_p: SqsResult, fd: FormData): Promise<SqsResult> {
  const name = String(fd.get("name"));
  try {
    const { sqs } = await aws();
    const group = String(fd.get("group") ?? "").trim();
    const dedup = String(fd.get("dedup") ?? "").trim();
    const attrs: Record<string, MessageAttributeValue> = {};
    for (const [k, v] of Object.entries(kvMap(fd.get("attributes")))) {
      attrs[k] = /^-?\d+(\.\d+)?$/.test(v) ? { DataType: "Number", StringValue: v } : { DataType: "String", StringValue: v };
    }
    const res = await sqs.send(
      new SendMessageCommand({
        QueueUrl: await urlOf(name),
        MessageBody: String(fd.get("body") ?? ""),
        MessageAttributes: Object.keys(attrs).length ? attrs : undefined,
        ...(name.endsWith(".fifo")
          ? { MessageGroupId: group || "default", ...(dedup ? { MessageDeduplicationId: dedup } : {}) }
          : { DelaySeconds: Number(fd.get("delay") || 0) }),
      }),
    );
    return { sent: `Your message has been sent and is ready to be received. Message ID: ${res.MessageId}` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function pollMessages(_p: SqsResult, fd: FormData): Promise<SqsResult> {
  const name = String(fd.get("name"));
  try {
    const { sqs } = await aws();
    const res = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: await urlOf(name),
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: Number(fd.get("wait") || 2),
        MessageSystemAttributeNames: ["All"],
        MessageAttributeNames: ["All"],
      }),
    );
    return {
      polledAt: Date.now(),
      messages: (res.Messages ?? []).map((m) => ({
        id: m.MessageId!,
        body: m.Body ?? "",
        receipt: m.ReceiptHandle!,
        sentAt: m.Attributes?.SentTimestamp,
        receiveCount: m.Attributes?.ApproximateReceiveCount,
        md5: m.MD5OfBody,
        system: m.Attributes ?? {},
        attributes: Object.fromEntries(Object.entries(m.MessageAttributes ?? {}).map(([k, v]) => [k, `${v.StringValue ?? "(binary)"} (${v.DataType})`])),
      })),
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteMessage(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { sqs } = await aws();
    await sqs.send(new DeleteMessageCommand({ QueueUrl: await urlOf(name), ReceiptHandle: String(fd.get("receipt")) }));
  } catch (e) {
    await flash("error", `Failed to delete message. ${errorMessage(e)}`);
  }
  revalidatePath(`/sqs/queues/${encodeURIComponent(name)}`);
}

async function setAttrs(name: string, Attributes: Record<string, string>) {
  const { sqs } = await aws();
  await sqs.send(new SetQueueAttributesCommand({ QueueUrl: await urlOf(name), Attributes }));
}

export async function updateQueue(fd: FormData) {
  const name = String(fd.get("name"));
  const attrs: Record<string, string> = {};
  const num = (field: string, attr: string, mult = 1) => {
    const v = String(fd.get(field) ?? "").trim();
    if (v !== "") attrs[attr] = String(Math.round(Number(v) * mult));
  };
  num("visibility", "VisibilityTimeout");
  num("retention", "MessageRetentionPeriod", 86400);
  num("maxSize", "MaximumMessageSize", 1024);
  num("delay", "DelaySeconds");
  num("wait", "ReceiveMessageWaitTimeSeconds");
  if (name.endsWith(".fifo")) {
    attrs.ContentBasedDeduplication = fd.get("contentDedup") === "on" ? "true" : "false";
    const scope = String(fd.get("dedupScope") ?? "");
    if (scope) attrs.DeduplicationScope = scope;
    const limit = String(fd.get("throughputLimit") ?? "");
    if (limit) attrs.FifoThroughputLimit = limit;
  }
  await guard(`Queue ${name} updated successfully.`, qp(name), () => setAttrs(name, attrs));
}

export async function updateEncryption(fd: FormData) {
  const name = String(fd.get("name"));
  const mode = String(fd.get("encryption"));
  const attrs: Record<string, string> =
    mode === "kms"
      ? { SqsManagedSseEnabled: "false", KmsMasterKeyId: String(fd.get("kmsKey") || "alias/aws/sqs"), KmsDataKeyReusePeriodSeconds: String(fd.get("reuse") || "300") }
      : mode === "sqs"
        ? { SqsManagedSseEnabled: "true", KmsMasterKeyId: "" }
        : { SqsManagedSseEnabled: "false", KmsMasterKeyId: "" };
  await guard(`Encryption for ${name} updated.`, qp(name), () => setAttrs(name, attrs));
}

export async function setRedrivePolicy(fd: FormData) {
  const name = String(fd.get("name"));
  const dlq = String(fd.get("dlqArn") ?? "");
  const policy = dlq ? JSON.stringify({ deadLetterTargetArn: dlq, maxReceiveCount: Number(fd.get("maxReceiveCount") || 10) }) : "";
  await guard(dlq ? `Dead-letter queue set for ${name}.` : `Dead-letter queue removed from ${name}.`, qp(name), () => setAttrs(name, { RedrivePolicy: policy }));
}

export async function setRedriveAllowPolicy(fd: FormData) {
  const name = String(fd.get("name"));
  const permission = String(fd.get("permission") || "allowAll");
  const arns = String(fd.get("sourceArns") ?? "").split(/[\s,]+/).filter(Boolean);
  const policy = JSON.stringify(permission === "byQueue" ? { redrivePermission: "byQueue", sourceQueueArns: arns } : { redrivePermission: permission });
  await guard(`Redrive allow policy for ${name} updated.`, qp(name), () => setAttrs(name, { RedriveAllowPolicy: policy }));
}

export async function startRedrive(fd: FormData) {
  const name = String(fd.get("name"));
  const source = String(fd.get("sourceArn"));
  const dest = String(fd.get("destinationArn") ?? "");
  const rate = String(fd.get("rate") ?? "").trim();
  await guard(`DLQ redrive started for ${name}.`, qp(name), async () => {
    const { sqs } = await aws();
    await sqs.send(
      new StartMessageMoveTaskCommand({
        SourceArn: source,
        DestinationArn: dest || undefined,
        MaxNumberOfMessagesPerSecond: rate ? Number(rate) : undefined,
      }),
    );
  });
}

export async function cancelRedrive(fd: FormData) {
  const name = String(fd.get("name"));
  await guard("Message move task canceled.", qp(name), async () => {
    const { sqs } = await aws();
    await sqs.send(new CancelMessageMoveTaskCommand({ TaskHandle: String(fd.get("handle")) }));
  });
}

export async function setQueuePolicy(fd: FormData) {
  const name = String(fd.get("name"));
  const text = String(fd.get("policy") ?? "").trim();
  await guard(text ? `Access policy for ${name} saved.` : `Access policy removed from ${name}.`, qp(name), async () => {
    if (text) parseJson(text, "Access policy");
    await setAttrs(name, { Policy: text });
  });
}

export async function addQueuePermission(fd: FormData) {
  const name = String(fd.get("name"));
  await guard(`Permission ${fd.get("label")} added.`, qp(name), async () => {
    const { sqs } = await aws();
    await sqs.send(
      new AddPermissionCommand({
        QueueUrl: await urlOf(name),
        Label: String(fd.get("label")),
        AWSAccountIds: String(fd.get("accounts")).split(/[\s,]+/).filter(Boolean),
        Actions: fd.getAll("actions").map(String),
      }),
    );
  });
}

export async function removeQueuePermission(fd: FormData) {
  const name = String(fd.get("name"));
  await guard(`Permission removed.`, qp(name), async () => {
    const { sqs } = await aws();
    for (const label of fd.getAll("selected").map(String)) await sqs.send(new RemovePermissionCommand({ QueueUrl: await urlOf(name), Label: label }));
  });
}

export async function tagQueue(fd: FormData) {
  const name = String(fd.get("name"));
  await guard(`Tag added to ${name}.`, qp(name), async () => {
    const { sqs } = await aws();
    await sqs.send(new TagQueueCommand({ QueueUrl: await urlOf(name), Tags: { [String(fd.get("key"))]: String(fd.get("value") ?? "") } }));
  });
}

export async function untagQueue(fd: FormData) {
  const name = String(fd.get("name"));
  await guard(`Tags removed from ${name}.`, qp(name), async () => {
    const { sqs } = await aws();
    await sqs.send(new UntagQueueCommand({ QueueUrl: await urlOf(name), TagKeys: fd.getAll("selected").map(String) }));
  });
}

export async function addLambdaTrigger(fd: FormData) {
  const name = String(fd.get("name"));
  const fn = String(fd.get("function"));
  await guard(`Lambda trigger ${fn} added to ${name}.`, qp(name), async () => {
    const { lambda } = await aws();
    await lambda.send(
      new CreateEventSourceMappingCommand({
        FunctionName: fn,
        EventSourceArn: String(fd.get("queueArn")),
        BatchSize: Number(fd.get("batchSize") || 10),
        Enabled: true,
      }),
    );
  });
}

export async function toggleLambdaTrigger(fd: FormData) {
  const name = String(fd.get("name"));
  const enable = fd.get("enable") === "true";
  await guard(`Trigger ${enable ? "enabled" : "disabled"}.`, qp(name), async () => {
    const { lambda } = await aws();
    for (const uuid of fd.getAll("selected").map(String)) await lambda.send(new UpdateEventSourceMappingCommand({ UUID: uuid, Enabled: enable }));
  });
}

export async function deleteLambdaTriggers(fd: FormData) {
  const name = String(fd.get("name"));
  await guard(`Lambda trigger deleted.`, qp(name), async () => {
    const { lambda } = await aws();
    for (const uuid of fd.getAll("selected").map(String)) await lambda.send(new DeleteEventSourceMappingCommand({ UUID: uuid }));
  });
}

export async function subscribeToTopic(fd: FormData) {
  const name = String(fd.get("name"));
  const topic = String(fd.get("topicArn"));
  await guard(`Queue ${name} subscribed to ${topic.split(":").pop()}.`, qp(name), async () => {
    const { sns, sqs } = await aws();
    await allowTopicToSendToQueue(sqs, String(fd.get("queueArn")), topic);
    await sns.send(
      new SubscribeCommand({
        TopicArn: topic,
        Protocol: "sqs",
        Endpoint: String(fd.get("queueArn")),
        Attributes: fd.get("raw") === "on" ? { RawMessageDelivery: "true" } : undefined,
      }),
    );
  });
}

export async function unsubscribeQueue(fd: FormData) {
  const name = String(fd.get("name"));
  await guard(`Subscription deleted.`, qp(name), async () => {
    const { sns } = await aws();
    for (const arn of fd.getAll("selected").map(String)) await sns.send(new UnsubscribeCommand({ SubscriptionArn: arn }));
  });
}
