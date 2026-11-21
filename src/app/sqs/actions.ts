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
} from "@aws-sdk/client-sqs";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

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
  messages?: { id: string; body: string; receipt: string; sentAt?: string; receiveCount?: string }[];
  polledAt?: number;
} | null;

export async function sendMessage(_p: SqsResult, fd: FormData): Promise<SqsResult> {
  const name = String(fd.get("name"));
  try {
    const { sqs } = await aws();
    const group = String(fd.get("group") ?? "").trim();
    const res = await sqs.send(
      new SendMessageCommand({
        QueueUrl: await urlOf(name),
        MessageBody: String(fd.get("body") ?? ""),
        ...(name.endsWith(".fifo") ? { MessageGroupId: group || "default" } : { DelaySeconds: Number(fd.get("delay") || 0) }),
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
