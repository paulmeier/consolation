"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { zipSync, strToU8 } from "fflate";
import { CreateFunctionCommand, DeleteFunctionCommand, InvokeCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import {
  AddPermissionCommand,
  CreateAliasCommand,
  CreateEventSourceMappingCommand,
  CreateFunctionUrlConfigCommand,
  DeleteAliasCommand,
  DeleteEventSourceMappingCommand,
  DeleteFunctionConcurrencyCommand,
  DeleteFunctionUrlConfigCommand,
  DeleteLayerVersionCommand,
  GetFunctionConfigurationCommand,
  PublishLayerVersionCommand,
  PublishVersionCommand,
  PutFunctionConcurrencyCommand,
  PutFunctionEventInvokeConfigCommand,
  RemovePermissionCommand,
  UpdateEventSourceMappingCommand,
  type EventSourcePosition,
  type Runtime,
} from "@aws-sdk/client-lambda";

import { CreateRoleCommand, GetRoleCommand, PutRolePolicyCommand } from "@aws-sdk/client-iam";
import { aws, errorMessage, type Clients } from "@/lib/emulator";
import { flash } from "@/lib/flash";
import { runtimeInfo, templateFor } from "./templates";

const ROLE = "consolation-lambda-execution-role";

async function ensureRole(iam: Clients["iam"]) {
  try {
    return (await iam.send(new GetRoleCommand({ RoleName: ROLE }))).Role!.Arn!;
  } catch {
    const res = await iam.send(
      new CreateRoleCommand({
        RoleName: ROLE,
        Description: "Created by Consolation for Lambda functions",
        AssumeRolePolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [{ Effect: "Allow", Principal: { Service: "lambda.amazonaws.com" }, Action: "sts:AssumeRole" }],
        }),
      }),
    );
    return res.Role!.Arn!;
  }
}

function zipOf(file: string, source: string) {
  return zipSync({ [file]: strToU8(source) });
}

export async function createFunction(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const runtime = String(fd.get("runtime") ?? "nodejs22.x");
  const rt = runtimeInfo(runtime);
  try {
    const { lambda, iam } = await aws();
    const roleArn = String(fd.get("role") ?? "").trim() || (await ensureRole(iam));
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: name,
        Runtime: runtime as never,
        Handler: rt.handler,
        Role: roleArn,
        Code: { ZipFile: zipOf(rt.file, templateFor(runtime)) },
        Description: String(fd.get("description") ?? ""),
        Timeout: 3,
        MemorySize: 128,
      }),
    );
  } catch (e) {
    await flash("error", `Failed to create function ${name}. ${errorMessage(e)}`);
    redirect("/lambda/functions/create");
  }
  await flash("success", `Successfully created the function ${name}. You can now change its code and configuration. To invoke your function with a test event, choose "Test".`);
  redirect(`/lambda/functions/${encodeURIComponent(name)}`);
}

export async function deleteFunctions(fd: FormData) {
  const { lambda } = await aws();
  for (const n of fd.getAll("selected").map(String)) {
    try {
      await lambda.send(new DeleteFunctionCommand({ FunctionName: n }));
      await flash("success", `Successfully deleted function ${n}.`);
    } catch (e) {
      await flash("error", `Failed to delete ${n}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/lambda/functions");
}

export async function deployCode(fd: FormData) {
  const name = String(fd.get("name"));
  const file = String(fd.get("file"));
  try {
    const { lambda } = await aws();
    await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: name, ZipFile: zipOf(file, String(fd.get("source") ?? "")) }));
    await flash("success", `Successfully updated the function ${name}.`);
  } catch (e) {
    await flash("error", `Failed to deploy code. ${errorMessage(e)}`);
  }
  revalidatePath(`/lambda/functions/${encodeURIComponent(name)}`);
}

export async function updateConfig(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { lambda } = await aws();
    const env = String(fd.get("env") ?? "").trim();
    let vars: Record<string, string> = {};
    if (env.startsWith("{")) vars = JSON.parse(env);
    else
      for (const line of env.split("\n")) {
        const i = line.indexOf("=");
        if (i > 0) vars[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
    const layers = String(fd.get("layers") ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: name,
        Description: String(fd.get("description") ?? ""),
        Timeout: Number(fd.get("timeout") ?? 3),
        MemorySize: Number(fd.get("memory") ?? 128),
        Environment: { Variables: vars },
        Layers: layers,
      }),
    );
    await flash("success", `Successfully updated the function ${name}.`);
  } catch (e) {
    await flash("error", `Failed to update configuration. ${errorMessage(e)}`);
  }
  revalidatePath(`/lambda/functions/${encodeURIComponent(name)}`);
}

export type InvokeResult = { ok: boolean; status?: number; payload?: string; log?: string; functionError?: string; error?: string; ms?: number } | null;

export async function invokeFunction(_prev: InvokeResult, fd: FormData): Promise<InvokeResult> {
  const name = String(fd.get("name"));
  const event = String(fd.get("event") ?? "{}");
  try {
    JSON.parse(event);
  } catch {
    return { ok: false, error: "The event must be valid JSON." };
  }
  const started = Date.now();
  try {
    const { lambda } = await aws();
    const res = await lambda.send(new InvokeCommand({ FunctionName: name, Payload: new TextEncoder().encode(event), LogType: "Tail" }));
    const payload = res.Payload ? new TextDecoder().decode(res.Payload) : "";
    let pretty = payload;
    try {
      pretty = JSON.stringify(JSON.parse(payload), null, 2);
    } catch {}
    return {
      ok: !res.FunctionError,
      status: res.StatusCode,
      payload: pretty,
      functionError: res.FunctionError,
      log: res.LogResult ? Buffer.from(res.LogResult, "base64").toString("utf8") : undefined,
      ms: Date.now() - started,
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e), ms: Date.now() - started };
  }
}

// ---------- Versions, aliases, triggers, destinations, URLs, permissions, layers

const fp = (n: string) => `/lambda/functions/${encodeURIComponent(n)}`;

async function run(ok: string, name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(fp(name));
}

export async function uploadZip(fd: FormData) {
  const name = String(fd.get("name"));
  const file = fd.get("zip");
  const { lambda } = await aws();
  await run(`Successfully uploaded the package for ${name}.`, name, async () => {
    if (!(file instanceof File) || !file.size) throw new Error("Choose a .zip file.");
    await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: name, ZipFile: new Uint8Array(await file.arrayBuffer()) }));
  });
}

export async function publishVersion(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { lambda } = await aws();
    const r = await lambda.send(new PublishVersionCommand({ FunctionName: name, Description: String(fd.get("description") ?? "") || undefined }));
    await flash("success", `Successfully created version ${r.Version} of ${name}.`);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(fp(name));
}

export async function createAlias(fd: FormData) {
  const name = String(fd.get("name"));
  const weightVersion = String(fd.get("weightVersion") ?? "");
  const weight = Number(fd.get("weight") || 0) / 100;
  const { lambda } = await aws();
  await run(`Alias ${fd.get("alias")} created.`, name, () =>
    lambda.send(
      new CreateAliasCommand({
        FunctionName: name,
        Name: String(fd.get("alias")),
        FunctionVersion: String(fd.get("version")),
        Description: String(fd.get("description") ?? "") || undefined,
        ...(weightVersion && weight > 0 ? { RoutingConfig: { AdditionalVersionWeights: { [weightVersion]: weight } } } : {}),
      }),
    ),
  );
}

export async function deleteAliases(fd: FormData) {
  const name = String(fd.get("name"));
  const { lambda } = await aws();
  for (const a of fd.getAll("selected").map(String)) await run(`Alias ${a} deleted.`, name, () => lambda.send(new DeleteAliasCommand({ FunctionName: name, Name: a })));
}

/** Grants the execution role what the trigger's poller needs, as the console offers to do. */
async function grantTriggerPermissions(name: string, sourceArn: string) {
  const { lambda, iam } = await aws();
  const role = (await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: name }))).Role ?? "";
  const roleName = role.split("/").pop()!;
  const service = sourceArn.split(":")[2];
  const actions =
    service === "sqs"
      ? ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"]
      : service === "kinesis"
        ? ["kinesis:GetRecords", "kinesis:GetShardIterator", "kinesis:DescribeStream", "kinesis:DescribeStreamSummary", "kinesis:ListShards", "kinesis:ListStreams", "kinesis:SubscribeToShard"]
        : ["dynamodb:GetRecords", "dynamodb:GetShardIterator", "dynamodb:DescribeStream", "dynamodb:ListStreams"];
  await iam.send(
    new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: `consolation-trigger-${service}`,
      PolicyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: actions, Resource: sourceArn.includes("/stream/") ? sourceArn : [sourceArn, `${sourceArn}/*`] }] }),
    }),
  );
}

export async function createTrigger(fd: FormData) {
  const name = String(fd.get("name"));
  const source = String(fd.get("source")).trim();
  const { lambda } = await aws();
  await run("Trigger added.", name, async () => {
    if (fd.get("grant") === "on") await grantTriggerPermissions(name, source);
    const isStream = !source.includes(":sqs:");
    await lambda.send(
      new CreateEventSourceMappingCommand({
        FunctionName: name,
        EventSourceArn: source,
        BatchSize: Number(fd.get("batch") || 10),
        Enabled: fd.get("enabled") === "on",
        ...(isStream ? { StartingPosition: String(fd.get("position") || "LATEST") as EventSourcePosition } : {}),
      }),
    );
  });
}

export async function toggleTriggers(fd: FormData) {
  const name = String(fd.get("name"));
  const enable = fd.get("enable") === "true";
  const { lambda } = await aws();
  for (const id of fd.getAll("selected").map(String)) await run(enable ? "Trigger enabled." : "Trigger disabled.", name, () => lambda.send(new UpdateEventSourceMappingCommand({ UUID: id, Enabled: enable })));
}

export async function deleteTriggers(fd: FormData) {
  const name = String(fd.get("name"));
  const { lambda } = await aws();
  for (const id of fd.getAll("selected").map(String)) await run("Trigger deleted.", name, () => lambda.send(new DeleteEventSourceMappingCommand({ UUID: id })));
}

export async function saveDestinations(fd: FormData) {
  const name = String(fd.get("name"));
  const ok = String(fd.get("onSuccess") ?? "").trim();
  const fail = String(fd.get("onFailure") ?? "").trim();
  const { lambda } = await aws();
  await run("Asynchronous invocation configuration saved.", name, () =>
    lambda.send(
      new PutFunctionEventInvokeConfigCommand({
        FunctionName: name,
        MaximumRetryAttempts: Number(fd.get("retries") ?? 2),
        MaximumEventAgeInSeconds: Number(fd.get("maxAge") || 21600),
        DestinationConfig: { OnSuccess: ok ? { Destination: ok } : {}, OnFailure: fail ? { Destination: fail } : {} },
      }),
    ),
  );
}

export async function setFunctionUrl(fd: FormData) {
  const name = String(fd.get("name"));
  const remove = fd.get("remove") === "true";
  const { lambda } = await aws();
  await run(remove ? "Function URL deleted." : "Function URL created.", name, () =>
    remove
      ? lambda.send(new DeleteFunctionUrlConfigCommand({ FunctionName: name }))
      : lambda.send(new CreateFunctionUrlConfigCommand({ FunctionName: name, AuthType: String(fd.get("auth") || "NONE") as "NONE" | "AWS_IAM", Cors: fd.get("cors") === "on" ? { AllowOrigins: ["*"], AllowMethods: ["*"] } : undefined })),
  );
}

export async function addFunctionPermission(fd: FormData) {
  const name = String(fd.get("name"));
  const { lambda } = await aws();
  await run("Permission added.", name, () =>
    lambda.send(
      new AddPermissionCommand({
        FunctionName: name,
        StatementId: String(fd.get("sid")),
        Action: String(fd.get("action") || "lambda:InvokeFunction"),
        Principal: String(fd.get("principal")),
        ...(String(fd.get("sourceArn") ?? "") ? { SourceArn: String(fd.get("sourceArn")) } : {}),
      }),
    ),
  );
}

export async function removeFunctionPermissions(fd: FormData) {
  const name = String(fd.get("name"));
  const { lambda } = await aws();
  for (const sid of fd.getAll("selected").map(String)) await run(`Statement ${sid} removed.`, name, () => lambda.send(new RemovePermissionCommand({ FunctionName: name, StatementId: sid })));
}

export async function setConcurrency(fd: FormData) {
  const name = String(fd.get("name"));
  const v = String(fd.get("reserved") ?? "").trim();
  const { lambda } = await aws();
  await run(v ? `Reserved concurrency set to ${v}.` : "Using unreserved account concurrency.", name, () =>
    v ? lambda.send(new PutFunctionConcurrencyCommand({ FunctionName: name, ReservedConcurrentExecutions: Number(v) })) : lambda.send(new DeleteFunctionConcurrencyCommand({ FunctionName: name })),
  );
}

export async function publishLayer(fd: FormData) {
  const layer = String(fd.get("layer") ?? "").trim();
  const file = fd.get("zip");
  try {
    if (!(file instanceof File) || !file.size) throw new Error("Choose a .zip file.");
    const { lambda } = await aws();
    const r = await lambda.send(
      new PublishLayerVersionCommand({
        LayerName: layer,
        Description: String(fd.get("description") ?? "") || undefined,
        Content: { ZipFile: new Uint8Array(await file.arrayBuffer()) },
        CompatibleRuntimes: fd.getAll("runtimes").map(String) as Runtime[],
      }),
    );
    await flash("success", `Successfully created layer ${layer} version ${r.Version}.`);
  } catch (e) {
    await flash("error", `Failed to create layer. ${errorMessage(e)}`);
  }
  revalidatePath("/lambda/layers");
}

export async function deleteLayerVersions(fd: FormData) {
  const { lambda } = await aws();
  for (const v of fd.getAll("selected").map(String)) {
    const [layer, version] = v.split("|");
    try {
      await lambda.send(new DeleteLayerVersionCommand({ LayerName: layer, VersionNumber: Number(version) }));
      await flash("success", `Deleted ${layer} version ${version}.`);
    } catch (e) {
      await flash("error", errorMessage(e));
    }
  }
  revalidatePath("/lambda/layers");
}
