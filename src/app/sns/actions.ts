"use server";

import { revalidatePath } from "next/cache";
import {
  ConfirmSubscriptionCommand,
  CreatePlatformApplicationCommand,
  CreatePlatformEndpointCommand,
  CreateSMSSandboxPhoneNumberCommand,
  CreateTopicCommand,
  DeleteEndpointCommand,
  DeletePlatformApplicationCommand,
  DeleteSMSSandboxPhoneNumberCommand,
  DeleteTopicCommand,
  OptInPhoneNumberCommand,
  PublishCommand,
  PutDataProtectionPolicyCommand,
  SetEndpointAttributesCommand,
  SetSMSAttributesCommand,
  SetSubscriptionAttributesCommand,
  SetTopicAttributesCommand,
  SubscribeCommand,
  TagResourceCommand,
  UnsubscribeCommand,
  UntagResourceCommand,
  VerifySMSSandboxPhoneNumberCommand,
  type MessageAttributeValue,
} from "@aws-sdk/client-sns";
import { redirect } from "next/navigation";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";
import { guard, kvMap, parseJson } from "@/lib/guard";
import { allowTopicToSendToQueue } from "@/lib/sqs-policy";

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
    const { sns, sqs } = await aws();
    const protocol = String(fd.get("protocol"));
    const endpoint = String(fd.get("endpoint") ?? "").trim();
    if (protocol === "sqs" && fd.get("allowQueue") === "on") await allowTopicToSendToQueue(sqs, endpoint, arn);
    await sns.send(new SubscribeCommand({ TopicArn: arn, Protocol: protocol, Endpoint: endpoint, ReturnSubscriptionArn: true }));
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
    const structure = fd.get("structure") === "json";
    const message = String(fd.get("message") ?? "");
    if (structure) {
      const o = parseJson(message, "Message") as Record<string, unknown>;
      if (typeof o?.default !== "string") throw new Error('A JSON message structure needs a "default" string key.');
    }
    const attrs: Record<string, MessageAttributeValue> = {};
    for (const [k, v] of Object.entries(kvMap(fd.get("attributes")))) {
      attrs[k] = /^-?\d+(\.\d+)?$/.test(v) ? { DataType: "Number", StringValue: v } : { DataType: "String", StringValue: v };
    }
    const dedup = String(fd.get("dedup") ?? "").trim();
    const res = await sns.send(
      new PublishCommand({
        TopicArn: arn,
        Message: message,
        MessageStructure: structure ? "json" : undefined,
        MessageAttributes: Object.keys(attrs).length ? attrs : undefined,
        ...(subject ? { Subject: subject } : {}),
        ...(arn.endsWith(".fifo") ? { MessageGroupId: String(fd.get("group") || "default"), ...(dedup ? { MessageDeduplicationId: dedup } : {}) } : {}),
      }),
    );
    await flash("success", `Message published to topic ${arn.split(":").pop()} successfully. Message ID: ${res.MessageId}`);
  } catch (e) {
    await flash("error", `Failed to publish message. ${errorMessage(e)}`);
  }
  revalidatePath(topicPath(arn));
}

const subPath = (arn: string) => `/sns/subscriptions/${encodeURIComponent(arn)}`;

async function setTopicAttr(arn: string, AttributeName: string, AttributeValue: string) {
  const { sns } = await aws();
  await sns.send(new SetTopicAttributesCommand({ TopicArn: arn, AttributeName, AttributeValue }));
}

export async function editTopic(fd: FormData) {
  const arn = String(fd.get("topic"));
  await guard(`Topic ${arn.split(":").pop()} updated.`, topicPath(arn), async () => {
    await setTopicAttr(arn, "DisplayName", String(fd.get("display") ?? ""));
    if (arn.endsWith(".fifo")) await setTopicAttr(arn, "ContentBasedDeduplication", fd.get("contentDedup") === "on" ? "true" : "false");
  });
}

/** Save one JSON-valued topic attribute (Policy, DeliveryPolicy); empty clears it. */
export async function setTopicJson(fd: FormData) {
  const arn = String(fd.get("topic"));
  const attr = String(fd.get("attribute"));
  const text = String(fd.get("value") ?? "").trim();
  if (!["Policy", "DeliveryPolicy"].includes(attr)) throw new Error("Unsupported attribute");
  await guard(`${attr === "Policy" ? "Access policy" : "Delivery policy"} saved.`, topicPath(arn), async () => {
    if (text) parseJson(text, attr);
    await setTopicAttr(arn, attr, text);
  });
}

export async function setTopicEncryption(fd: FormData) {
  const arn = String(fd.get("topic"));
  const on = fd.get("encryption") === "on";
  await guard(`Encryption ${on ? "enabled" : "disabled"}.`, topicPath(arn), () => setTopicAttr(arn, "KmsMasterKeyId", on ? String(fd.get("kmsKey") || "alias/aws/sns") : ""));
}

const LOGGING = ["Application", "HTTP", "Lambda", "SQS", "Firehose"] as const;

export async function setDeliveryLogging(fd: FormData) {
  const arn = String(fd.get("topic"));
  await guard("Delivery status logging saved.", topicPath(arn), async () => {
    for (const p of LOGGING) {
      const on = fd.get(`log-${p}`) === "on";
      const was = fd.get(`was-${p}`) === "1";
      if (on) {
        await setTopicAttr(arn, `${p}SuccessFeedbackRoleArn`, String(fd.get("successRole") ?? ""));
        await setTopicAttr(arn, `${p}FailureFeedbackRoleArn`, String(fd.get("failureRole") ?? ""));
        await setTopicAttr(arn, `${p}SuccessFeedbackSampleRate`, String(fd.get("sampleRate") || "100"));
      } else if (was) {
        // Turning a protocol off clears its role ARNs (the sample rate can't be empty).
        await setTopicAttr(arn, `${p}SuccessFeedbackRoleArn`, "");
        await setTopicAttr(arn, `${p}FailureFeedbackRoleArn`, "");
      }
    }
  });
}

export async function putDataProtection(fd: FormData) {
  const arn = String(fd.get("topic"));
  const text = String(fd.get("value") ?? "").trim();
  await guard("Data protection policy saved.", topicPath(arn), async () => {
    parseJson(text, "Data protection policy");
    const { sns } = await aws();
    await sns.send(new PutDataProtectionPolicyCommand({ ResourceArn: arn, DataProtectionPolicy: text }));
  });
}

export async function tagTopic(fd: FormData) {
  const arn = String(fd.get("topic"));
  await guard("Tag added.", topicPath(arn), async () => {
    const { sns } = await aws();
    await sns.send(new TagResourceCommand({ ResourceArn: arn, Tags: [{ Key: String(fd.get("key")), Value: String(fd.get("value") ?? "") }] }));
  });
}

export async function untagTopic(fd: FormData) {
  const arn = String(fd.get("topic"));
  await guard("Tags removed.", topicPath(arn), async () => {
    const { sns } = await aws();
    await sns.send(new UntagResourceCommand({ ResourceArn: arn, TagKeys: fd.getAll("selected").map(String) }));
  });
}

export async function confirmSubscription(fd: FormData) {
  const arn = String(fd.get("topic"));
  await guard("Subscription confirmed.", [topicPath(arn), "/sns/subscriptions"], async () => {
    const { sns } = await aws();
    await sns.send(new ConfirmSubscriptionCommand({ TopicArn: arn, Token: String(fd.get("token")).trim(), AuthenticateOnUnsubscribe: fd.get("auth") === "on" ? "true" : undefined }));
  });
}

async function setSubAttr(arn: string, AttributeName: string, AttributeValue: string) {
  const { sns } = await aws();
  await sns.send(new SetSubscriptionAttributesCommand({ SubscriptionArn: arn, AttributeName, AttributeValue }));
}

export async function editSubscription(fd: FormData) {
  const arn = String(fd.get("subscription"));
  const filter = String(fd.get("filter") ?? "").trim();
  const redriveDlq = String(fd.get("dlq") ?? "").trim();
  await guard("Subscription updated.", subPath(arn), async () => {
    // Only send what changed: the emulator rejects empty values for unset attributes.
    if (filter) parseJson(filter, "Filter policy");
    if (filter || fd.get("hadFilter")) await setSubAttr(arn, "FilterPolicy", filter);
    if (filter) await setSubAttr(arn, "FilterPolicyScope", String(fd.get("scope") || "MessageAttributes"));
    if (fd.get("rawAllowed")) await setSubAttr(arn, "RawMessageDelivery", fd.get("raw") === "on" ? "true" : "false");
    if (redriveDlq) await setSubAttr(arn, "RedrivePolicy", JSON.stringify({ deadLetterTargetArn: redriveDlq }));
    else if (fd.get("hadDlq")) await setSubAttr(arn, "RedrivePolicy", "");
  });
}

export async function deleteSubscriptions(fd: FormData) {
  const { sns } = await aws();
  for (const s of fd.getAll("selected").map(String)) {
    try {
      await sns.send(new UnsubscribeCommand({ SubscriptionArn: s }));
      await flash("success", "Subscription deleted.");
    } catch (e) {
      await flash("error", `Failed to delete subscription. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/sns/subscriptions");
  if (fd.get("redirect")) redirect("/sns/subscriptions");
}

// Mobile push
const PUSH = "/sns/mobile/push";

export async function createPlatformApp(fd: FormData) {
  const name = String(fd.get("name")).trim();
  await guard(`Platform application ${name} created.`, PUSH, async () => {
    const { sns } = await aws();
    const platform = String(fd.get("platform"));
    const cred = String(fd.get("credential") ?? "");
    const principal = String(fd.get("principal") ?? "");
    await sns.send(
      new CreatePlatformApplicationCommand({
        Name: name,
        Platform: platform,
        Attributes: { PlatformCredential: cred, ...(principal ? { PlatformPrincipal: principal } : {}) },
      }),
    );
  });
}

export async function deletePlatformApps(fd: FormData) {
  await guard("Platform application deleted.", PUSH, async () => {
    const { sns } = await aws();
    for (const arn of fd.getAll("selected").map(String)) await sns.send(new DeletePlatformApplicationCommand({ PlatformApplicationArn: arn }));
  });
}

export async function createEndpoint(fd: FormData) {
  const app = String(fd.get("app"));
  await guard("Application endpoint created.", `${PUSH}/${encodeURIComponent(app)}`, async () => {
    const { sns } = await aws();
    await sns.send(new CreatePlatformEndpointCommand({ PlatformApplicationArn: app, Token: String(fd.get("token")).trim(), CustomUserData: String(fd.get("userData") ?? "") || undefined }));
  });
}

export async function setEndpointEnabled(fd: FormData) {
  const app = String(fd.get("app"));
  const enable = fd.get("enable") === "true";
  await guard(`Endpoint ${enable ? "enabled" : "disabled"}.`, `${PUSH}/${encodeURIComponent(app)}`, async () => {
    const { sns } = await aws();
    for (const arn of fd.getAll("selected").map(String)) await sns.send(new SetEndpointAttributesCommand({ EndpointArn: arn, Attributes: { Enabled: String(enable) } }));
  });
}

export async function deleteEndpoints(fd: FormData) {
  const app = String(fd.get("app"));
  await guard("Endpoint deleted.", `${PUSH}/${encodeURIComponent(app)}`, async () => {
    const { sns } = await aws();
    for (const arn of fd.getAll("selected").map(String)) await sns.send(new DeleteEndpointCommand({ EndpointArn: arn }));
  });
}

export async function publishToEndpoint(fd: FormData) {
  const app = String(fd.get("app"));
  await guard("Message published to endpoint.", `${PUSH}/${encodeURIComponent(app)}`, async () => {
    const { sns } = await aws();
    await sns.send(new PublishCommand({ TargetArn: String(fd.get("endpoint")), Message: String(fd.get("message") ?? "") }));
  });
}

// SMS
const SMS = "/sns/mobile/text-messaging";

export async function setSmsPreferences(fd: FormData) {
  await guard("Text messaging preferences saved.", SMS, async () => {
    const { sns } = await aws();
    const attributes: Record<string, string> = {};
    for (const k of ["DefaultSMSType", "MonthlySpendLimit", "DefaultSenderID", "UsageReportS3Bucket"]) {
      const v = String(fd.get(k) ?? "").trim();
      if (v) attributes[k] = v;
    }
    await sns.send(new SetSMSAttributesCommand({ attributes }));
  });
}

export async function addSandboxNumber(fd: FormData) {
  await guard("Phone number added. Enter the verification code to verify it.", SMS, async () => {
    const { sns } = await aws();
    await sns.send(new CreateSMSSandboxPhoneNumberCommand({ PhoneNumber: String(fd.get("phone")).trim(), LanguageCode: "en-US" }));
  });
}

export async function verifySandboxNumber(fd: FormData) {
  await guard("Phone number verified.", SMS, async () => {
    const { sns } = await aws();
    await sns.send(new VerifySMSSandboxPhoneNumberCommand({ PhoneNumber: String(fd.get("phone")), OneTimePassword: String(fd.get("otp")).trim() }));
  });
}

export async function deleteSandboxNumbers(fd: FormData) {
  await guard("Phone number deleted.", SMS, async () => {
    const { sns } = await aws();
    for (const n of fd.getAll("selected").map(String)) await sns.send(new DeleteSMSSandboxPhoneNumberCommand({ PhoneNumber: n }));
  });
}

export async function optInNumbers(fd: FormData) {
  await guard("Phone number opted in.", SMS, async () => {
    const { sns } = await aws();
    for (const n of fd.getAll("selected").map(String)) await sns.send(new OptInPhoneNumberCommand({ phoneNumber: n }));
  });
}
