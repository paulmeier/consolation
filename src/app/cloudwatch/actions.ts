"use server";

import { revalidatePath } from "next/cache";
import { CreateLogGroupCommand, CreateLogStreamCommand, DeleteLogGroupCommand, DeleteLogStreamCommand, PutLogEventsCommand, PutRetentionPolicyCommand } from "@aws-sdk/client-cloudwatch-logs";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const groupPath = (g: string) => `/cloudwatch/log-groups/${encodeURIComponent(g)}`;

export async function createLogGroup(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { logs } = await aws();
    await logs.send(new CreateLogGroupCommand({ logGroupName: name }));
    const days = Number(fd.get("retention") || 0);
    if (days > 0) await logs.send(new PutRetentionPolicyCommand({ logGroupName: name, retentionInDays: days }));
    await flash("success", `Log group ${name} has been created.`);
  } catch (e) {
    await flash("error", `Failed to create log group ${name}. ${errorMessage(e)}`);
  }
  revalidatePath("/cloudwatch/log-groups");
}

export async function deleteLogGroups(fd: FormData) {
  const { logs } = await aws();
  for (const g of fd.getAll("selected").map(String)) {
    try {
      await logs.send(new DeleteLogGroupCommand({ logGroupName: g }));
      await flash("success", `Log group ${g} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete log group ${g}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/cloudwatch/log-groups");
}

export async function createLogStream(fd: FormData) {
  const group = String(fd.get("group"));
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { logs } = await aws();
    await logs.send(new CreateLogStreamCommand({ logGroupName: group, logStreamName: name }));
    await flash("success", `Log stream ${name} created.`);
  } catch (e) {
    await flash("error", `Failed to create log stream. ${errorMessage(e)}`);
  }
  revalidatePath(groupPath(group));
}

export async function deleteLogStreams(fd: FormData) {
  const group = String(fd.get("group"));
  const { logs } = await aws();
  for (const s of fd.getAll("selected").map(String)) {
    try {
      await logs.send(new DeleteLogStreamCommand({ logGroupName: group, logStreamName: s }));
      await flash("success", `Log stream ${s} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete log stream. ${errorMessage(e)}`);
    }
  }
  revalidatePath(groupPath(group));
}

export async function putLogEvent(fd: FormData) {
  const group = String(fd.get("group"));
  const stream = String(fd.get("stream"));
  try {
    const { logs } = await aws();
    const lines = String(fd.get("message") ?? "").split("\n").filter((l) => l.trim());
    const now = Date.now();
    await logs.send(new PutLogEventsCommand({ logGroupName: group, logStreamName: stream, logEvents: lines.map((message, i) => ({ timestamp: now + i, message })) }));
    await flash("success", `Put ${lines.length} log event${lines.length === 1 ? "" : "s"}.`);
  } catch (e) {
    await flash("error", `Failed to put log events. ${errorMessage(e)}`);
  }
  revalidatePath(groupPath(group));
}
