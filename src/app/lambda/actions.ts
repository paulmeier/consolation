"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { zipSync, strToU8 } from "fflate";
import { CreateFunctionCommand, DeleteFunctionCommand, InvokeCommand, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import { CreateRoleCommand, GetRoleCommand } from "@aws-sdk/client-iam";
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
    const vars: Record<string, string> = {};
    for (const line of env.split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) vars[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: name,
        Description: String(fd.get("description") ?? ""),
        Timeout: Number(fd.get("timeout") ?? 3),
        MemorySize: Number(fd.get("memory") ?? 128),
        Environment: { Variables: vars },
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
