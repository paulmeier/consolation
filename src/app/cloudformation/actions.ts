"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateChangeSetCommand,
  CreateStackCommand,
  DeleteChangeSetCommand,
  DeleteStackCommand,
  DetectStackDriftCommand,
  ExecuteChangeSetCommand,
  UpdateStackCommand,
  ValidateTemplateCommand,
  type Capability,
  type Parameter,
} from "@aws-sdk/client-cloudformation";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const sp = (name: string) => `/cloudformation/stacks/${encodeURIComponent(name)}`;
const CAPS: Capability[] = ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"];

function params(fd: FormData): Parameter[] {
  return String(fd.get("parameters") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.includes("="))
    .map((l) => ({ ParameterKey: l.slice(0, l.indexOf("=")).trim(), ParameterValue: l.slice(l.indexOf("=") + 1).trim() }));
}

async function template(fd: FormData) {
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) return await file.text();
  return String(fd.get("template") ?? "");
}

export async function createStack(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { cfn } = await aws();
    const body = await template(fd);
    await cfn.send(new ValidateTemplateCommand({ TemplateBody: body }));
    await cfn.send(new CreateStackCommand({ StackName: name, TemplateBody: body, Parameters: params(fd), Capabilities: CAPS, OnFailure: String(fd.get("onFailure") ?? "ROLLBACK") as "ROLLBACK" | "DELETE" | "DO_NOTHING" }));
  } catch (e) {
    await flash("error", `Failed to create stack ${name}. ${errorMessage(e)}`);
    redirect("/cloudformation/stacks/create");
  }
  await flash("success", `Stack ${name} creation initiated.`);
  redirect(sp(name));
}

export async function updateStack(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { cfn } = await aws();
    await cfn.send(new UpdateStackCommand({ StackName: name, TemplateBody: await template(fd), Parameters: params(fd), Capabilities: CAPS }));
    await flash("success", `Stack ${name} update initiated.`);
  } catch (e) {
    await flash("error", `Failed to update stack. ${errorMessage(e)}`);
  }
  revalidatePath(sp(name));
}

export async function deleteStacks(fd: FormData) {
  const { cfn } = await aws();
  for (const n of fd.getAll("selected").map(String)) {
    try {
      await cfn.send(new DeleteStackCommand({ StackName: n }));
      await flash("success", `Stack ${n} deletion initiated.`);
    } catch (e) {
      await flash("error", `Failed to delete ${n}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/cloudformation/stacks");
  if (fd.get("from") === "detail") redirect("/cloudformation/stacks");
}

export async function createChangeSet(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { cfn } = await aws();
    await cfn.send(
      new CreateChangeSetCommand({ StackName: name, ChangeSetName: String(fd.get("changeSet") || `cs-${Date.now()}`), TemplateBody: await template(fd), Parameters: params(fd), Capabilities: CAPS, ChangeSetType: "UPDATE" }),
    );
    await flash("success", "Change set created. Review it below, then execute it.");
  } catch (e) {
    await flash("error", `Failed to create change set. ${errorMessage(e)}`);
  }
  revalidatePath(sp(name));
}

export async function executeChangeSet(fd: FormData) {
  const name = String(fd.get("name"));
  const { cfn } = await aws();
  for (const cs of fd.getAll("selected").map(String)) {
    try {
      await cfn.send(new ExecuteChangeSetCommand({ StackName: name, ChangeSetName: cs }));
      await flash("success", `Executing change set ${cs}.`);
    } catch (e) {
      await flash("error", `Failed to execute change set. ${errorMessage(e)}`);
    }
  }
  revalidatePath(sp(name));
}

export async function deleteChangeSets(fd: FormData) {
  const name = String(fd.get("name"));
  const { cfn } = await aws();
  for (const cs of fd.getAll("selected").map(String)) {
    try {
      await cfn.send(new DeleteChangeSetCommand({ StackName: name, ChangeSetName: cs }));
      await flash("success", `Change set ${cs} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete change set. ${errorMessage(e)}`);
    }
  }
  revalidatePath(sp(name));
}

export async function detectDrift(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { cfn } = await aws();
    await cfn.send(new DetectStackDriftCommand({ StackName: name }));
    await flash("success", "Drift detection started. Refresh to see the result.");
  } catch (e) {
    await flash("error", `Drift detection failed. ${errorMessage(e)}`);
  }
  revalidatePath(sp(name));
}
