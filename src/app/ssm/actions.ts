"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AddTagsToResourceCommand,
  DeleteParametersCommand,
  GetParameterCommand,
  LabelParameterVersionCommand,
  PutParameterCommand,
  RemoveTagsFromResourceCommand,
  UnlabelParameterVersionCommand,
  type ParameterTier,
  type ParameterType,
} from "@aws-sdk/client-ssm";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const view = (name: string) => `/ssm/parameters/view?name=${encodeURIComponent(name)}`;

export async function putParameter(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const overwrite = fd.get("overwrite") === "true";
  try {
    const { ssm } = await aws();
    const type = String(fd.get("type") ?? "String") as ParameterType;
    const kms = String(fd.get("kmsKeyId") ?? "").trim();
    const description = String(fd.get("description") ?? "");
    await ssm.send(
      new PutParameterCommand({
        Name: name,
        Value: String(fd.get("value") ?? ""),
        Type: overwrite ? undefined : type,
        Tier: String(fd.get("tier") ?? "Standard") as ParameterTier,
        DataType: String(fd.get("dataType") ?? "text"),
        Overwrite: overwrite,
        ...(description ? { Description: description } : {}),
        ...(type === "SecureString" && kms ? { KeyId: kms } : {}),
      }),
    );
  } catch (e) {
    await flash("error", `Failed to ${overwrite ? "update" : "create"} parameter ${name}. ${errorMessage(e)}`);
    redirect(overwrite ? view(name) : "/ssm/parameters/create");
  }
  await flash("success", overwrite ? `Parameter ${name} was updated.` : `Create parameter request succeeded: ${name}.`);
  redirect(view(name));
}

export async function deleteParameters(fd: FormData) {
  const names = fd.getAll("selected").map(String);
  try {
    const { ssm } = await aws();
    for (let i = 0; i < names.length; i += 10) {
      const r = await ssm.send(new DeleteParametersCommand({ Names: names.slice(i, i + 10) }));
      if (r.InvalidParameters?.length) throw new Error(`Not found: ${r.InvalidParameters.join(", ")}`);
    }
    await flash("success", `Deleted ${names.length} parameter${names.length === 1 ? "" : "s"}.`);
  } catch (e) {
    await flash("error", `Failed to delete parameters. ${errorMessage(e)}`);
  }
  revalidatePath("/ssm/parameters");
  if (fd.get("from") === "detail") redirect("/ssm/parameters");
}

export type ValueResult = { value?: string; error?: string } | null;

export async function showDecrypted(_p: ValueResult, fd: FormData): Promise<ValueResult> {
  try {
    const { ssm } = await aws();
    const r = await ssm.send(new GetParameterCommand({ Name: String(fd.get("name")), WithDecryption: true }));
    return { value: r.Parameter?.Value ?? "" };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function labelVersion(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { ssm } = await aws();
    const labels = String(fd.get("labels") ?? "").split(",").map((l) => l.trim()).filter(Boolean);
    const r = await ssm.send(new LabelParameterVersionCommand({ Name: name, ParameterVersion: Number(fd.get("version")), Labels: labels }));
    if (r.InvalidLabels?.length) throw new Error(`Invalid labels: ${r.InvalidLabels.join(", ")}`);
    await flash("success", `Labels attached to version ${fd.get("version")}.`);
  } catch (e) {
    await flash("error", `Failed to attach labels. ${errorMessage(e)}`);
  }
  revalidatePath("/ssm/parameters/view");
}

export async function unlabelVersion(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { ssm } = await aws();
    await ssm.send(new UnlabelParameterVersionCommand({ Name: name, ParameterVersion: Number(fd.get("version")), Labels: [String(fd.get("label"))] }));
    await flash("success", "Label removed.");
  } catch (e) {
    await flash("error", `Failed to remove label. ${errorMessage(e)}`);
  }
  revalidatePath("/ssm/parameters/view");
}

export async function tagParameter(fd: FormData) {
  try {
    const { ssm } = await aws();
    await ssm.send(new AddTagsToResourceCommand({ ResourceType: "Parameter", ResourceId: String(fd.get("name")), Tags: [{ Key: String(fd.get("key")), Value: String(fd.get("value") ?? "") }] }));
    await flash("success", "Tag added.");
  } catch (e) {
    await flash("error", `Failed to add tag. ${errorMessage(e)}`);
  }
  revalidatePath("/ssm/parameters/view");
}

export async function untagParameter(fd: FormData) {
  try {
    const { ssm } = await aws();
    await ssm.send(new RemoveTagsFromResourceCommand({ ResourceType: "Parameter", ResourceId: String(fd.get("name")), TagKeys: fd.getAll("selected").map(String) }));
    await flash("success", "Tags removed.");
  } catch (e) {
    await flash("error", `Failed to remove tags. ${errorMessage(e)}`);
  }
  revalidatePath("/ssm/parameters/view");
}
