"use server";

import { revalidatePath } from "next/cache";
import {
  AttachRolePolicyCommand,
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  CreateUserCommand,
  DeleteAccessKeyCommand,
  DeletePolicyCommand,
  DeleteRoleCommand,
  DeleteUserCommand,
  DetachRolePolicyCommand,
  DetachUserPolicyCommand,
  ListAccessKeysCommand,
  ListAttachedRolePoliciesCommand,
  ListAttachedUserPoliciesCommand,
  ListPolicyVersionsCommand,
  DeletePolicyVersionCommand,
} from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

export async function createUser(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { iam } = await aws();
    await iam.send(new CreateUserCommand({ UserName: name }));
    await flash("success", `User ${name} created.`);
  } catch (e) {
    await flash("error", `Failed to create user ${name}. ${errorMessage(e)}`);
  }
  revalidatePath("/iam/users");
}

export async function deleteUsers(fd: FormData) {
  const { iam } = await aws();
  for (const u of fd.getAll("selected").map(String)) {
    try {
      for (const k of (await iam.send(new ListAccessKeysCommand({ UserName: u }))).AccessKeyMetadata ?? [])
        await iam.send(new DeleteAccessKeyCommand({ UserName: u, AccessKeyId: k.AccessKeyId! }));
      for (const p of (await iam.send(new ListAttachedUserPoliciesCommand({ UserName: u }))).AttachedPolicies ?? [])
        await iam.send(new DetachUserPolicyCommand({ UserName: u, PolicyArn: p.PolicyArn! }));
      await iam.send(new DeleteUserCommand({ UserName: u }));
      await flash("success", `User ${u} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete user ${u}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/iam/users");
}

export type KeyResult = { id?: string; secret?: string; error?: string } | null;

export async function createAccessKey(_p: KeyResult, fd: FormData): Promise<KeyResult> {
  const user = String(fd.get("user"));
  try {
    const { iam } = await aws();
    const k = (await iam.send(new CreateAccessKeyCommand({ UserName: user }))).AccessKey!;
    revalidatePath(`/iam/users/${encodeURIComponent(user)}`);
    return { id: k.AccessKeyId, secret: k.SecretAccessKey };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteAccessKeys(fd: FormData) {
  const user = String(fd.get("user"));
  const { iam } = await aws();
  for (const id of fd.getAll("selected").map(String)) {
    try {
      await iam.send(new DeleteAccessKeyCommand({ UserName: user, AccessKeyId: id }));
      await flash("success", `Access key ${id} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete access key. ${errorMessage(e)}`);
    }
  }
  revalidatePath(`/iam/users/${encodeURIComponent(user)}`);
}

export async function attachPolicy(fd: FormData) {
  const kind = String(fd.get("kind"));
  const name = String(fd.get("principal"));
  const arn = String(fd.get("policy") ?? "").trim();
  try {
    const { iam } = await aws();
    if (kind === "user") await iam.send(new AttachUserPolicyCommand({ UserName: name, PolicyArn: arn }));
    else await iam.send(new AttachRolePolicyCommand({ RoleName: name, PolicyArn: arn }));
    await flash("success", `Policy attached to ${name}.`);
  } catch (e) {
    await flash("error", `Failed to attach policy. ${errorMessage(e)}`);
  }
  revalidatePath(`/iam/${kind}s/${encodeURIComponent(name)}`);
}

export async function detachPolicies(fd: FormData) {
  const kind = String(fd.get("kind"));
  const name = String(fd.get("principal"));
  const { iam } = await aws();
  for (const arn of fd.getAll("selected").map(String)) {
    try {
      if (kind === "user") await iam.send(new DetachUserPolicyCommand({ UserName: name, PolicyArn: arn }));
      else await iam.send(new DetachRolePolicyCommand({ RoleName: name, PolicyArn: arn }));
      await flash("success", "Policy removed.");
    } catch (e) {
      await flash("error", `Failed to remove policy. ${errorMessage(e)}`);
    }
  }
  revalidatePath(`/iam/${kind}s/${encodeURIComponent(name)}`);
}

const TRUST: Record<string, string> = {
  lambda: "lambda.amazonaws.com",
  ec2: "ec2.amazonaws.com",
  ecs: "ecs-tasks.amazonaws.com",
  states: "states.amazonaws.com",
};

export async function createRole(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const service = TRUST[String(fd.get("service"))] ?? "lambda.amazonaws.com";
  try {
    const { iam } = await aws();
    await iam.send(
      new CreateRoleCommand({
        RoleName: name,
        Description: String(fd.get("description") ?? ""),
        AssumeRolePolicyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: { Service: service }, Action: "sts:AssumeRole" }] }),
      }),
    );
    await flash("success", `Role ${name} created.`);
  } catch (e) {
    await flash("error", `Failed to create role ${name}. ${errorMessage(e)}`);
  }
  revalidatePath("/iam/roles");
}

export async function deleteRoles(fd: FormData) {
  const { iam } = await aws();
  for (const r of fd.getAll("selected").map(String)) {
    try {
      for (const p of (await iam.send(new ListAttachedRolePoliciesCommand({ RoleName: r }))).AttachedPolicies ?? [])
        await iam.send(new DetachRolePolicyCommand({ RoleName: r, PolicyArn: p.PolicyArn! }));
      await iam.send(new DeleteRoleCommand({ RoleName: r }));
      await flash("success", `Role ${r} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete role ${r}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/iam/roles");
}

export async function createPolicy(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const doc = String(fd.get("document") ?? "");
    JSON.parse(doc);
    const { iam } = await aws();
    await iam.send(new CreatePolicyCommand({ PolicyName: name, PolicyDocument: doc, Description: String(fd.get("description") ?? "") }));
    await flash("success", `Policy ${name} created.`);
  } catch (e) {
    await flash("error", `Failed to create policy ${name}. ${errorMessage(e)}`);
  }
  revalidatePath("/iam/policies");
}

export async function deletePolicies(fd: FormData) {
  const { iam } = await aws();
  for (const arn of fd.getAll("selected").map(String)) {
    try {
      for (const v of (await iam.send(new ListPolicyVersionsCommand({ PolicyArn: arn }))).Versions ?? [])
        if (!v.IsDefaultVersion) await iam.send(new DeletePolicyVersionCommand({ PolicyArn: arn, VersionId: v.VersionId! }));
      await iam.send(new DeletePolicyCommand({ PolicyArn: arn }));
      await flash("success", `Policy ${arn.split("/").pop()} deleted.`);
    } catch (e) {
      await flash("error", `Failed to delete policy. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/iam/policies");
}
