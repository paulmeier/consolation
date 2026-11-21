"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateSecretCommand,
  DeleteResourcePolicyCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  PutResourcePolicyCommand,
  PutSecretValueCommand,
  RestoreSecretCommand,
  RotateSecretCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const path = (name: string) => `/secretsmanager/secrets/${encodeURIComponent(name)}`;

export async function createSecret(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { secrets } = await aws();
    const kms = String(fd.get("kmsKeyId") ?? "").trim();
    await secrets.send(
      new CreateSecretCommand({
        Name: name,
        Description: String(fd.get("description") ?? "") || undefined,
        SecretString: String(fd.get("value") ?? ""),
        ...(kms ? { KmsKeyId: kms } : {}),
      }),
    );
  } catch (e) {
    await flash("error", `Failed to store secret ${name}. ${errorMessage(e)}`);
    redirect("/secretsmanager/secrets/create");
  }
  await flash("success", `You successfully stored the secret ${name}.`);
  redirect(path(name));
}

export async function deleteSecrets(fd: FormData) {
  const force = fd.get("force") === "on";
  const days = Math.min(30, Math.max(7, Number(fd.get("window") || 30)));
  const { secrets } = await aws();
  for (const id of fd.getAll("selected").map(String)) {
    try {
      await secrets.send(new DeleteSecretCommand({ SecretId: id, ...(force ? { ForceDeleteWithoutRecovery: true } : { RecoveryWindowInDays: days }) }));
      await flash("success", force ? `Secret ${id} deleted.` : `The secret ${id} is scheduled for deletion in ${days} days.`);
    } catch (e) {
      await flash("error", `Failed to delete ${id}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/secretsmanager/secrets");
}

export async function restoreSecret(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { secrets } = await aws();
    await secrets.send(new RestoreSecretCommand({ SecretId: name }));
    await flash("success", `Deletion of ${name} was cancelled.`);
  } catch (e) {
    await flash("error", `Failed to cancel deletion. ${errorMessage(e)}`);
  }
  revalidatePath(path(name));
}

export type RevealResult = { value?: string; binary?: boolean; error?: string; version?: string } | null;

export async function revealSecret(_p: RevealResult, fd: FormData): Promise<RevealResult> {
  const name = String(fd.get("name"));
  const versionId = String(fd.get("versionId") ?? "") || undefined;
  try {
    const { secrets } = await aws();
    const r = await secrets.send(new GetSecretValueCommand({ SecretId: name, ...(versionId ? { VersionId: versionId } : {}) }));
    if (r.SecretString !== undefined) return { value: r.SecretString, version: r.VersionId };
    return { value: r.SecretBinary ? Buffer.from(r.SecretBinary).toString("base64") : "", binary: true, version: r.VersionId };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function putSecretValue(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { secrets } = await aws();
    await secrets.send(new PutSecretValueCommand({ SecretId: name, SecretString: String(fd.get("value") ?? "") }));
    await flash("success", `Secret value for ${name} updated. A new version is now AWSCURRENT.`);
  } catch (e) {
    await flash("error", `Failed to update the secret value. ${errorMessage(e)}`);
  }
  revalidatePath(path(name));
}

export async function updateSecret(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { secrets } = await aws();
    const kms = String(fd.get("kmsKeyId") ?? "").trim();
    await secrets.send(new UpdateSecretCommand({ SecretId: name, Description: String(fd.get("description") ?? ""), ...(kms ? { KmsKeyId: kms } : {}) }));
    await flash("success", `Secret ${name} updated.`);
  } catch (e) {
    await flash("error", `Failed to update secret. ${errorMessage(e)}`);
  }
  revalidatePath(path(name));
}

export async function savePolicy(fd: FormData) {
  const name = String(fd.get("name"));
  const policy = String(fd.get("policy") ?? "").trim();
  try {
    const { secrets } = await aws();
    if (policy) {
      JSON.parse(policy);
      await secrets.send(new PutResourcePolicyCommand({ SecretId: name, ResourcePolicy: policy }));
      await flash("success", "Resource permissions saved.");
    } else {
      await secrets.send(new DeleteResourcePolicyCommand({ SecretId: name }));
      await flash("success", "Resource permissions deleted.");
    }
  } catch (e) {
    await flash("error", `Failed to save resource permissions. ${errorMessage(e)}`);
  }
  revalidatePath(path(name));
}

export async function rotateSecret(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { secrets } = await aws();
    const fn = String(fd.get("lambda") ?? "").trim();
    const days = Number(fd.get("days") || 30);
    await secrets.send(
      new RotateSecretCommand({
        SecretId: name,
        ...(fn ? { RotationLambdaARN: fn, RotationRules: { AutomaticallyAfterDays: days } } : {}),
        RotateImmediately: fd.get("now") === "on",
      }),
    );
    await flash("success", `Rotation configured for ${name}.`);
  } catch (e) {
    await flash("error", `Failed to configure rotation. ${errorMessage(e)}`);
  }
  revalidatePath(path(name));
}

export async function tagSecret(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { secrets } = await aws();
    await secrets.send(new TagResourceCommand({ SecretId: name, Tags: [{ Key: String(fd.get("key")), Value: String(fd.get("value") ?? "") }] }));
    await flash("success", "Tag added.");
  } catch (e) {
    await flash("error", `Failed to add tag. ${errorMessage(e)}`);
  }
  revalidatePath(path(name));
}

export async function untagSecret(fd: FormData) {
  const name = String(fd.get("name"));
  try {
    const { secrets } = await aws();
    await secrets.send(new UntagResourceCommand({ SecretId: name, TagKeys: fd.getAll("selected").map(String) }));
    await flash("success", "Tags removed.");
  } catch (e) {
    await flash("error", `Failed to remove tags. ${errorMessage(e)}`);
  }
  revalidatePath(path(name));
}
