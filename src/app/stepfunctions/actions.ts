"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateActivityCommand,
  CreateStateMachineCommand,
  DeleteActivityCommand,
  DeleteStateMachineCommand,
  RedriveExecutionCommand,
  StartExecutionCommand,
  StopExecutionCommand,
  UpdateStateMachineCommand,
  ValidateStateMachineDefinitionCommand,
  type StateMachineType,
} from "@aws-sdk/client-sfn";
import { CreateRoleCommand, GetRoleCommand } from "@aws-sdk/client-iam";
import { aws, errorMessage, type Clients } from "@/lib/emulator";
import { flash } from "@/lib/flash";
import { execPath, smPath } from "./shared";

const ROLE = "consolation-stepfunctions-role";

async function ensureRole(iam: Clients["iam"]) {
  try {
    return (await iam.send(new GetRoleCommand({ RoleName: ROLE }))).Role!.Arn!;
  } catch {
    const r = await iam.send(
      new CreateRoleCommand({
        RoleName: ROLE,
        Description: "Created by Consolation for Step Functions state machines",
        AssumeRolePolicyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: { Service: "states.amazonaws.com" }, Action: "sts:AssumeRole" }] }),
      }),
    );
    return r.Role!.Arn!;
  }
}

async function validate(sfn: Clients["sfn"], definition: string, type: StateMachineType) {
  JSON.parse(definition);
  try {
    const v = await sfn.send(new ValidateStateMachineDefinitionCommand({ definition, type }));
    const errs = (v.diagnostics ?? []).filter((d) => d.severity === "ERROR");
    if (v.result === "FAIL" || errs.length) throw new Error(errs.map((d) => `${d.code}: ${d.message}${d.location ? ` (${d.location})` : ""}`).join("; ") || "Definition is invalid.");
  } catch (e) {
    if ((e as Error).name === "NotImplemented") return; // validation is optional
    throw e;
  }
}

export async function createStateMachine(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  let arn = "";
  try {
    const { sfn, iam } = await aws();
    const definition = String(fd.get("definition") ?? "");
    const type = String(fd.get("type") ?? "STANDARD") as StateMachineType;
    await validate(sfn, definition, type);
    const roleArn = String(fd.get("role") ?? "").trim() || (await ensureRole(iam));
    arn = (await sfn.send(new CreateStateMachineCommand({ name, definition, roleArn, type }))).stateMachineArn!;
  } catch (e) {
    await flash("error", `Failed to create state machine ${name}. ${errorMessage(e)}`);
    redirect("/stepfunctions/state-machines/create");
  }
  await flash("success", `Successfully created state machine ${name}.`);
  redirect(smPath(arn));
}

export async function updateStateMachine(fd: FormData) {
  const arn = String(fd.get("arn"));
  try {
    const { sfn } = await aws();
    const definition = String(fd.get("definition") ?? "");
    await validate(sfn, definition, String(fd.get("type") ?? "STANDARD") as StateMachineType);
    await sfn.send(new UpdateStateMachineCommand({ stateMachineArn: arn, definition }));
    await flash("success", "State machine definition saved.");
  } catch (e) {
    await flash("error", `Failed to save definition. ${errorMessage(e)}`);
  }
  revalidatePath(smPath(arn));
}

export async function deleteStateMachines(fd: FormData) {
  const { sfn } = await aws();
  for (const arn of fd.getAll("selected").map(String)) {
    try {
      await sfn.send(new DeleteStateMachineCommand({ stateMachineArn: arn }));
      await flash("success", `State machine ${arn.split(":").pop()} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete state machine. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/stepfunctions/state-machines");
  if (fd.get("from") === "detail") redirect("/stepfunctions/state-machines");
}

export async function startExecution(fd: FormData) {
  const arn = String(fd.get("arn"));
  let execArn = "";
  try {
    const input = String(fd.get("input") ?? "{}") || "{}";
    JSON.parse(input);
    const name = String(fd.get("name") ?? "").trim();
    const { sfn } = await aws();
    execArn = (await sfn.send(new StartExecutionCommand({ stateMachineArn: arn, input, ...(name ? { name } : {}) }))).executionArn!;
  } catch (e) {
    await flash("error", `Failed to start execution. ${errorMessage(e)}`);
    redirect(smPath(arn));
  }
  await flash("success", "Execution started.");
  redirect(execPath(execArn));
}

export async function stopExecution(fd: FormData) {
  const arn = String(fd.get("arn"));
  try {
    const { sfn } = await aws();
    await sfn.send(new StopExecutionCommand({ executionArn: arn, error: String(fd.get("error") ?? "") || undefined, cause: String(fd.get("cause") ?? "") || undefined }));
    await flash("success", "Execution stopped.");
  } catch (e) {
    await flash("error", `Failed to stop execution. ${errorMessage(e)}`);
  }
  revalidatePath(execPath(arn));
}

export async function redriveExecution(fd: FormData) {
  const arn = String(fd.get("arn"));
  try {
    const { sfn } = await aws();
    await sfn.send(new RedriveExecutionCommand({ executionArn: arn }));
    await flash("success", "Execution redriven.");
  } catch (e) {
    await flash("error", `Failed to redrive execution. ${errorMessage(e)}`);
  }
  revalidatePath(execPath(arn));
}

export async function createActivity(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { sfn } = await aws();
    await sfn.send(new CreateActivityCommand({ name }));
    await flash("success", `Activity ${name} created.`);
  } catch (e) {
    await flash("error", `Failed to create activity. ${errorMessage(e)}`);
  }
  revalidatePath("/stepfunctions/activities");
}

export async function deleteActivities(fd: FormData) {
  const { sfn } = await aws();
  for (const arn of fd.getAll("selected").map(String)) {
    try {
      await sfn.send(new DeleteActivityCommand({ activityArn: arn }));
      await flash("success", `Activity ${arn.split(":").pop()} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete activity. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/stepfunctions/activities");
}
