"use server";

import { revalidatePath } from "next/cache";
import { CreateTopicCommand, DeleteTopicCommand, PublishCommand, SubscribeCommand, UnsubscribeCommand } from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const topicPath = (arn: string) => `/sns/topics/${encodeURIComponent(arn)}`;

export async function createTopic(fd: FormData) {
  let name = String(fd.get("name") ?? "").trim();
  const fifo = fd.get("type") === "fifo";
  if (fifo && !name.endsWith(".fifo")) name += ".fifo";
  try {
    const { sns } = await aws();
    const display = String(fd.get("display") ?? "").trim();
    await sns.send(
      new CreateTopicCommand({
        Name: name,
        Attributes: { ...(fifo ? { FifoTopic: "true", ContentBasedDeduplication: "true" } : {}), ...(display ? { DisplayName: display } : {}) },
      }),
    );
    await flash("success", `Topic ${name} created successfully.`);
  } catch (e) {
    await flash("error", `Failed to create topic ${name}. ${errorMessage(e)}`);
  }
  revalidatePath("/sns/topics");
}

export async function deleteTopics(fd: FormData) {
  const { sns } = await aws();
  for (const arn of fd.getAll("selected").map(String)) {
    try {
      await sns.send(new DeleteTopicCommand({ TopicArn: arn }));
      await flash("success", `Topic ${arn.split(":").pop()} deleted successfully.`);
    } catch (e) {
      await flash("error", `Failed to delete topic. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/sns/topics");
}

export async function subscribe(fd: FormData) {
  const arn = String(fd.get("topic"));
  try {
    const { sns } = await aws();
    await sns.send(new SubscribeCommand({ TopicArn: arn, Protocol: String(fd.get("protocol")), Endpoint: String(fd.get("endpoint") ?? "").trim(), ReturnSubscriptionArn: true }));
    await flash("success", "Subscription created successfully.");
  } catch (e) {
    await flash("error", `Failed to create subscription. ${errorMessage(e)}`);
  }
  revalidatePath(topicPath(arn));
}

export async function unsubscribe(fd: FormData) {
  const arn = String(fd.get("topic"));
  const { sns } = await aws();
  for (const s of fd.getAll("selected").map(String)) {
    try {
      await sns.send(new UnsubscribeCommand({ SubscriptionArn: s }));
      await flash("success", "Subscription deleted.");
    } catch (e) {
      await flash("error", `Failed to delete subscription. ${errorMessage(e)}`);
    }
  }
  revalidatePath(topicPath(arn));
}

export async function publish(fd: FormData) {
  const arn = String(fd.get("topic"));
  try {
    const { sns } = await aws();
    const subject = String(fd.get("subject") ?? "").trim();
    const res = await sns.send(
      new PublishCommand({
        TopicArn: arn,
        Message: String(fd.get("message") ?? ""),
        ...(subject ? { Subject: subject } : {}),
        ...(arn.endsWith(".fifo") ? { MessageGroupId: String(fd.get("group") || "default") } : {}),
      }),
    );
    await flash("success", `Message published to topic ${arn.split(":").pop()} successfully. Message ID: ${res.MessageId}`);
  } catch (e) {
    await flash("error", `Failed to publish message. ${errorMessage(e)}`);
  }
  revalidatePath(topicPath(arn));
}
