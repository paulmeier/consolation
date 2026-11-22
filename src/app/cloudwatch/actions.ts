"use server";

import { revalidatePath } from "next/cache";
import {
  AssociateKmsKeyCommand,
  CancelExportTaskCommand,
  CreateExportTaskCommand,
  CreateLogAnomalyDetectorCommand,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DeleteDataProtectionPolicyCommand,
  DeleteLogAnomalyDetectorCommand,
  DeleteLogGroupCommand,
  DeleteLogStreamCommand,
  DeleteMetricFilterCommand,
  DeleteQueryDefinitionCommand,
  DeleteRetentionPolicyCommand,
  DeleteSubscriptionFilterCommand,
  DisassociateKmsKeyCommand,
  GetQueryResultsCommand,
  PutDataProtectionPolicyCommand,
  PutLogEventsCommand,
  PutMetricFilterCommand,
  PutQueryDefinitionCommand,
  PutRetentionPolicyCommand,
  PutSubscriptionFilterCommand,
  StartQueryCommand,
  StopQueryCommand,
  TagResourceCommand,
  TestMetricFilterCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { GetBucketPolicyCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { aws, errorMessage, REGION, EMULATOR_ACCOUNT } from "@/lib/emulator";
import { flash } from "@/lib/flash";
import { guard, parseJson } from "@/lib/guard";

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

const groupArn = (g: string) => `arn:aws:logs:${REGION}:${EMULATOR_ACCOUNT}:log-group:${g}`;

export async function editLogGroup(fd: FormData) {
  const group = String(fd.get("group"));
  const days = Number(fd.get("retention") || 0);
  const kms = String(fd.get("kms") ?? "").trim();
  const hadKms = String(fd.get("hadKms") ?? "");
  await guard(`Log group ${group} updated.`, [groupPath(group), "/cloudwatch/log-groups"], async () => {
    const { logs } = await aws();
    if (days > 0) await logs.send(new PutRetentionPolicyCommand({ logGroupName: group, retentionInDays: days }));
    else await logs.send(new DeleteRetentionPolicyCommand({ logGroupName: group }));
    if (kms && kms !== hadKms) await logs.send(new AssociateKmsKeyCommand({ logGroupName: group, kmsKeyId: kms }));
    else if (!kms && hadKms) await logs.send(new DisassociateKmsKeyCommand({ logGroupName: group }));
  });
}

export async function putMetricFilter(fd: FormData) {
  const group = String(fd.get("group"));
  const name = String(fd.get("name")).trim();
  await guard(`Metric filter ${name} saved.`, groupPath(group), async () => {
    const { logs } = await aws();
    const dflt = String(fd.get("default") ?? "").trim();
    await logs.send(
      new PutMetricFilterCommand({
        logGroupName: group,
        filterName: name,
        filterPattern: String(fd.get("pattern") ?? ""),
        metricTransformations: [
          {
            metricName: String(fd.get("metric")).trim(),
            metricNamespace: String(fd.get("namespace")).trim(),
            metricValue: String(fd.get("value") || "1"),
            ...(dflt ? { defaultValue: Number(dflt) } : {}),
            ...(fd.get("unit") ? { unit: String(fd.get("unit")) as "Count" } : {}),
          },
        ],
      }),
    );
  });
}

export async function deleteMetricFilters(fd: FormData) {
  const group = String(fd.get("group"));
  await guard("Metric filter deleted.", groupPath(group), async () => {
    const { logs } = await aws();
    for (const n of fd.getAll("selected").map(String)) await logs.send(new DeleteMetricFilterCommand({ logGroupName: group, filterName: n }));
  });
}

export type TestResult = { matches?: { line: number; message: string; values: string }[]; error?: string } | null;

export async function testMetricFilter(_p: TestResult, fd: FormData): Promise<TestResult> {
  try {
    const { logs } = await aws();
    const lines = String(fd.get("samples") ?? "").split("\n").filter((l) => l.trim());
    const r = await logs.send(new TestMetricFilterCommand({ filterPattern: String(fd.get("pattern") ?? ""), logEventMessages: lines }));
    return { matches: (r.matches ?? []).map((m) => ({ line: m.eventNumber ?? 0, message: m.eventMessage ?? "", values: JSON.stringify(m.extractedValues ?? {}) })) };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function putSubscriptionFilter(fd: FormData) {
  const group = String(fd.get("group"));
  const name = String(fd.get("name")).trim();
  await guard(`Subscription filter ${name} saved.`, groupPath(group), async () => {
    const { logs } = await aws();
    const role = String(fd.get("role") ?? "").trim();
    await logs.send(
      new PutSubscriptionFilterCommand({
        logGroupName: group,
        filterName: name,
        filterPattern: String(fd.get("pattern") ?? ""),
        destinationArn: String(fd.get("destination")).trim(),
        ...(role ? { roleArn: role } : {}),
        distribution: fd.get("distribution") === "Random" ? "Random" : "ByLogStream",
      }),
    );
  });
}

export async function deleteSubscriptionFilters(fd: FormData) {
  const group = String(fd.get("group"));
  await guard("Subscription filter deleted.", groupPath(group), async () => {
    const { logs } = await aws();
    for (const n of fd.getAll("selected").map(String)) await logs.send(new DeleteSubscriptionFilterCommand({ logGroupName: group, filterName: n }));
  });
}

export async function exportToS3(fd: FormData) {
  const group = String(fd.get("group"));
  const bucket = String(fd.get("bucket")).trim();
  const hours = Number(fd.get("hours") || 24);
  await guard(`Export task for ${group} created.`, `${groupPath(group)}?tab=exports`, async () => {
    const { logs, s3 } = await aws();
    if (fd.get("grant") === "on") {
      // CloudWatch Logs checks the bucket ACL and writes with bucket-owner-full-control.
      let policy: { Version: string; Statement: unknown[] } = { Version: "2012-10-17", Statement: [] };
      try {
        const cur = (await s3.send(new GetBucketPolicyCommand({ Bucket: bucket }))).Policy;
        if (cur) policy = JSON.parse(cur);
      } catch {}
      policy.Statement = [
        ...policy.Statement.filter((st) => !String((st as { Sid?: string }).Sid ?? "").startsWith("ConsolationLogsExport")),
        { Sid: "ConsolationLogsExportAcl", Effect: "Allow", Principal: { Service: "logs.amazonaws.com" }, Action: "s3:GetBucketAcl", Resource: `arn:aws:s3:::${bucket}` },
        { Sid: "ConsolationLogsExportPut", Effect: "Allow", Principal: { Service: "logs.amazonaws.com" }, Action: "s3:PutObject", Resource: `arn:aws:s3:::${bucket}/*`, Condition: { StringEquals: { "s3:x-amz-acl": "bucket-owner-full-control" } } },
      ];
      await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }));
    }
    const to = Date.now();
    const prefix = String(fd.get("prefix") ?? "").trim();
    const stream = String(fd.get("streamPrefix") ?? "").trim();
    await logs.send(
      new CreateExportTaskCommand({
        logGroupName: group,
        destination: bucket,
        from: to - hours * 3600_000,
        to,
        ...(prefix ? { destinationPrefix: prefix } : {}),
        ...(stream ? { logStreamNamePrefix: stream } : {}),
      }),
    );
  });
}

export async function cancelExportTask(fd: FormData) {
  const group = String(fd.get("group"));
  await guard("Export task canceled.", `${groupPath(group)}?tab=exports`, async () => {
    const { logs } = await aws();
    await logs.send(new CancelExportTaskCommand({ taskId: String(fd.get("task")) }));
  });
}

export async function putLogDataProtection(fd: FormData) {
  const group = String(fd.get("group"));
  const text = String(fd.get("policy") ?? "").trim();
  await guard(text ? "Data protection policy saved." : "Data protection policy deleted.", groupPath(group), async () => {
    const { logs } = await aws();
    if (text) {
      parseJson(text, "Data protection policy");
      await logs.send(new PutDataProtectionPolicyCommand({ logGroupIdentifier: group, policyDocument: text }));
    } else await logs.send(new DeleteDataProtectionPolicyCommand({ logGroupIdentifier: group }));
  });
}

export async function createAnomalyDetector(fd: FormData) {
  const group = String(fd.get("group"));
  await guard("Anomaly detector created.", groupPath(group), async () => {
    const { logs } = await aws();
    const pattern = String(fd.get("pattern") ?? "").trim();
    await logs.send(
      new CreateLogAnomalyDetectorCommand({
        logGroupArnList: [groupArn(group)],
        detectorName: String(fd.get("name") ?? "").trim() || undefined,
        evaluationFrequency: (String(fd.get("frequency") || "FIFTEEN_MIN")) as "FIFTEEN_MIN",
        ...(pattern ? { filterPattern: pattern } : {}),
      }),
    );
  });
}

export async function deleteAnomalyDetectors(fd: FormData) {
  const group = String(fd.get("group"));
  await guard("Anomaly detector deleted.", groupPath(group), async () => {
    const { logs } = await aws();
    for (const arn of fd.getAll("selected").map(String)) await logs.send(new DeleteLogAnomalyDetectorCommand({ anomalyDetectorArn: arn }));
  });
}

export async function tagLogGroup(fd: FormData) {
  const group = String(fd.get("group"));
  await guard("Tag added.", groupPath(group), async () => {
    const { logs } = await aws();
    await logs.send(new TagResourceCommand({ resourceArn: groupArn(group), tags: { [String(fd.get("key"))]: String(fd.get("value") ?? "") } }));
  });
}

export async function untagLogGroup(fd: FormData) {
  const group = String(fd.get("group"));
  await guard("Tags removed.", groupPath(group), async () => {
    const { logs } = await aws();
    await logs.send(new UntagResourceCommand({ resourceArn: groupArn(group), tagKeys: fd.getAll("selected").map(String) }));
  });
}

// Logs Insights
export type QueryState = {
  queryId?: string;
  status?: string;
  fields?: string[];
  rows?: Record<string, string>[];
  stats?: { recordsMatched?: number; recordsScanned?: number; bytesScanned?: number };
  error?: string;
} | null;

export async function startInsightsQuery(_p: QueryState, fd: FormData): Promise<QueryState> {
  try {
    const { logs } = await aws();
    const groups = fd.getAll("groups").map(String);
    if (!groups.length) return { error: "Select at least one log group." };
    const minutes = Number(fd.get("minutes") || 60);
    const end = Math.floor(Date.now() / 1000);
    const r = await logs.send(
      new StartQueryCommand({
        logGroupNames: groups,
        queryString: String(fd.get("query") ?? ""),
        startTime: minutes > 0 ? end - minutes * 60 : 0,
        endTime: end + 60,
        limit: Number(fd.get("limit") || 1000),
      }),
    );
    return { queryId: r.queryId, status: "Scheduled" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function pollInsightsQuery(queryId: string): Promise<QueryState> {
  try {
    const { logs } = await aws();
    const r = await logs.send(new GetQueryResultsCommand({ queryId }));
    const rows = (r.results ?? []).map((row) => Object.fromEntries(row.filter((f) => f.field !== "@ptr").map((f) => [f.field!, f.value ?? ""])));
    const fields = Array.from(new Set(rows.flatMap((x) => Object.keys(x))));
    return { queryId, status: r.status, rows, fields, stats: r.statistics };
  } catch (e) {
    return { queryId, error: errorMessage(e) };
  }
}

export async function stopInsightsQuery(queryId: string) {
  try {
    const { logs } = await aws();
    await logs.send(new StopQueryCommand({ queryId }));
  } catch {}
}

export async function saveQueryDefinition(fd: FormData) {
  const name = String(fd.get("name")).trim();
  await guard(`Query ${name} saved.`, "/cloudwatch/logs-insights", async () => {
    const { logs } = await aws();
    const id = String(fd.get("id") ?? "");
    await logs.send(
      new PutQueryDefinitionCommand({
        name,
        queryString: String(fd.get("query") ?? ""),
        logGroupNames: fd.getAll("groups").map(String),
        ...(id ? { queryDefinitionId: id } : {}),
      }),
    );
  });
}

export async function deleteQueryDefinition(fd: FormData) {
  await guard("Saved query deleted.", "/cloudwatch/logs-insights", async () => {
    const { logs } = await aws();
    await logs.send(new DeleteQueryDefinitionCommand({ queryDefinitionId: String(fd.get("id")) }));
  });
}
