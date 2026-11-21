"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateApiDestinationCommand,
  CreateArchiveCommand,
  CreateConnectionCommand,
  CreateEventBusCommand,
  DeleteApiDestinationCommand,
  DeleteArchiveCommand,
  DeleteConnectionCommand,
  DeleteEventBusCommand,
  DeleteRuleCommand,
  DisableRuleCommand,
  EnableRuleCommand,
  ListTargetsByRuleCommand,
  PutEventsCommand,
  PutRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
  StartReplayCommand,
  TestEventPatternCommand,
  type ApiDestinationHttpMethod,
  type ConnectionAuthorizationType,
} from "@aws-sdk/client-eventbridge";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const rp = (bus: string, name: string) => `/eventbridge/rules/${encodeURIComponent(bus)}/${encodeURIComponent(name)}`;

async function guard(ok: string, path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(path);
}

export async function createBus(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const { events } = await aws();
  await guard(`Event bus ${name} created.`, "/eventbridge/buses", () => events.send(new CreateEventBusCommand({ Name: name, Description: String(fd.get("description") ?? "") || undefined })));
}

export async function deleteBuses(fd: FormData) {
  const { events } = await aws();
  for (const n of fd.getAll("selected").map(String)) await guard(`Event bus ${n} deleted.`, "/eventbridge/buses", () => events.send(new DeleteEventBusCommand({ Name: n })));
}

export async function createRule(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const bus = String(fd.get("bus") ?? "default");
  try {
    const { events } = await aws();
    const kind = String(fd.get("kind"));
    const pattern = String(fd.get("pattern") ?? "").trim();
    const schedule = String(fd.get("schedule") ?? "").trim();
    if (kind === "pattern") JSON.parse(pattern);
    await events.send(
      new PutRuleCommand({
        Name: name,
        EventBusName: bus,
        Description: String(fd.get("description") ?? "") || undefined,
        State: fd.get("enabled") === "on" ? "ENABLED" : "DISABLED",
        ...(kind === "pattern" ? { EventPattern: pattern } : { ScheduleExpression: schedule }),
      }),
    );
    const target = String(fd.get("target") ?? "").trim();
    if (target) await events.send(new PutTargetsCommand({ Rule: name, EventBusName: bus, Targets: [{ Id: "target-1", Arn: target }] }));
  } catch (e) {
    await flash("error", `Failed to create rule ${name}. ${errorMessage(e)}`);
    redirect("/eventbridge/rules/create");
  }
  await flash("success", `Rule ${name} was created successfully.`);
  redirect(rp(bus, name));
}

export async function updatePattern(fd: FormData) {
  const name = String(fd.get("name"));
  const bus = String(fd.get("bus"));
  const { events } = await aws();
  await guard("Rule updated.", rp(bus, name), async () => {
    const pattern = String(fd.get("pattern") ?? "");
    JSON.parse(pattern);
    await events.send(new PutRuleCommand({ Name: name, EventBusName: bus, EventPattern: pattern, State: String(fd.get("state")) as "ENABLED" | "DISABLED", Description: String(fd.get("description") ?? "") || undefined }));
  });
}

export async function setRuleState(fd: FormData) {
  const name = String(fd.get("name"));
  const bus = String(fd.get("bus"));
  const enable = fd.get("enable") === "true";
  const { events } = await aws();
  await guard(enable ? "Rule enabled." : "Rule disabled.", rp(bus, name), () => events.send(enable ? new EnableRuleCommand({ Name: name, EventBusName: bus }) : new DisableRuleCommand({ Name: name, EventBusName: bus })));
}

export async function deleteRules(fd: FormData) {
  const { events } = await aws();
  for (const key of fd.getAll("selected").map(String)) {
    const [bus, name] = key.split("|");
    await guard(`Rule ${name} deleted.`, "/eventbridge/rules", async () => {
      const t = await events.send(new ListTargetsByRuleCommand({ Rule: name, EventBusName: bus }));
      if (t.Targets?.length) await events.send(new RemoveTargetsCommand({ Rule: name, EventBusName: bus, Ids: t.Targets.map((x) => x.Id!) }));
      await events.send(new DeleteRuleCommand({ Name: name, EventBusName: bus }));
    });
  }
  if (fd.get("from") === "detail") redirect("/eventbridge/rules");
}

export async function addTarget(fd: FormData) {
  const name = String(fd.get("name"));
  const bus = String(fd.get("bus"));
  const { events } = await aws();
  await guard("Target added.", rp(bus, name), () => {
    const input = String(fd.get("input") ?? "").trim();
    if (input) JSON.parse(input);
    return events.send(
      new PutTargetsCommand({
        Rule: name,
        EventBusName: bus,
        Targets: [{ Id: String(fd.get("id") || `target-${Date.now()}`), Arn: String(fd.get("arn")), ...(input ? { Input: input } : {}), ...(String(fd.get("role") ?? "") ? { RoleArn: String(fd.get("role")) } : {}) }],
      }),
    );
  });
}

export async function removeTargets(fd: FormData) {
  const name = String(fd.get("name"));
  const bus = String(fd.get("bus"));
  const { events } = await aws();
  await guard("Targets removed.", rp(bus, name), () => events.send(new RemoveTargetsCommand({ Rule: name, EventBusName: bus, Ids: fd.getAll("selected").map(String) })));
}

export type SendResult = { ok?: string; error?: string } | null;

export async function sendEvent(_p: SendResult, fd: FormData): Promise<SendResult> {
  try {
    const detail = String(fd.get("detail") ?? "{}");
    JSON.parse(detail);
    const { events } = await aws();
    const r = await events.send(
      new PutEventsCommand({
        Entries: [{ EventBusName: String(fd.get("bus") ?? "default"), Source: String(fd.get("source")), DetailType: String(fd.get("detailType")), Detail: detail, Resources: String(fd.get("resources") ?? "").split(",").map((s) => s.trim()).filter(Boolean) }],
      }),
    );
    const entry = r.Entries?.[0];
    if (r.FailedEntryCount || entry?.ErrorCode) return { error: `${entry?.ErrorCode}: ${entry?.ErrorMessage}` };
    return { ok: `Event sent. Event ID: ${entry?.EventId}` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export type TestResult = { match?: boolean; error?: string } | null;

export async function testPattern(_p: TestResult, fd: FormData): Promise<TestResult> {
  try {
    const { events } = await aws();
    const r = await events.send(new TestEventPatternCommand({ EventPattern: String(fd.get("pattern")), Event: String(fd.get("event")) }));
    return { match: !!r.Result };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function createArchive(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const { events } = await aws();
  await guard(`Archive ${name} created.`, "/eventbridge/archives", async () => {
    const pattern = String(fd.get("pattern") ?? "").trim();
    if (pattern) JSON.parse(pattern);
    const days = Number(fd.get("retention") || 0);
    await events.send(new CreateArchiveCommand({ ArchiveName: name, EventSourceArn: String(fd.get("source")), ...(pattern ? { EventPattern: pattern } : {}), ...(days ? { RetentionDays: days } : {}) }));
  });
}

export async function deleteArchives(fd: FormData) {
  const { events } = await aws();
  for (const n of fd.getAll("selected").map(String)) await guard(`Archive ${n} deleted.`, "/eventbridge/archives", () => events.send(new DeleteArchiveCommand({ ArchiveName: n })));
}

export async function startReplay(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const { events } = await aws();
  await guard(`Replay ${name} started.`, "/eventbridge/archives", () =>
    events.send(
      new StartReplayCommand({
        ReplayName: name,
        EventSourceArn: String(fd.get("archiveArn")),
        EventStartTime: new Date(String(fd.get("start"))),
        EventEndTime: new Date(String(fd.get("end"))),
        Destination: { Arn: String(fd.get("busArn")) },
      }),
    ),
  );
}

export async function createConnection(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const { events } = await aws();
  await guard(`Connection ${name} created.`, "/eventbridge/destinations", () =>
    events.send(
      new CreateConnectionCommand({
        Name: name,
        AuthorizationType: "API_KEY" as ConnectionAuthorizationType,
        AuthParameters: { ApiKeyAuthParameters: { ApiKeyName: String(fd.get("keyName")), ApiKeyValue: String(fd.get("keyValue")) } },
      }),
    ),
  );
}

export async function deleteConnections(fd: FormData) {
  const { events } = await aws();
  for (const n of fd.getAll("selected").map(String)) await guard(`Connection ${n} deleted.`, "/eventbridge/destinations", () => events.send(new DeleteConnectionCommand({ Name: n })));
}

export async function createDestination(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const { events } = await aws();
  await guard(`API destination ${name} created.`, "/eventbridge/destinations", () =>
    events.send(
      new CreateApiDestinationCommand({
        Name: name,
        ConnectionArn: String(fd.get("connection")),
        InvocationEndpoint: String(fd.get("endpoint")),
        HttpMethod: String(fd.get("method")) as ApiDestinationHttpMethod,
        InvocationRateLimitPerSecond: Number(fd.get("rate") || 300),
      }),
    ),
  );
}

export async function deleteDestinations(fd: FormData) {
  const { events } = await aws();
  for (const n of fd.getAll("selected").map(String)) await guard(`API destination ${n} deleted.`, "/eventbridge/destinations", () => events.send(new DeleteApiDestinationCommand({ Name: n })));
}
