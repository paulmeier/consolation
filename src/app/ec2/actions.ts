"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateKeyPairCommand,
  CreateSecurityGroupCommand,
  DeleteKeyPairCommand,
  DeleteSecurityGroupCommand,
  RebootInstancesCommand,
  RunInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
  type _InstanceType,
} from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

export async function launchInstance(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const count = Math.max(1, Math.min(10, Number(fd.get("count") || 1)));
  let ids: string[] = [];
  try {
    const { ec2 } = await aws();
    const key = String(fd.get("key") ?? "");
    const sg = String(fd.get("sg") ?? "");
    const res = await ec2.send(
      new RunInstancesCommand({
        ImageId: String(fd.get("ami")),
        InstanceType: String(fd.get("type")) as _InstanceType,
        MinCount: count,
        MaxCount: count,
        ...(key ? { KeyName: key } : {}),
        ...(sg ? { SecurityGroupIds: [sg] } : {}),
        ...(name ? { TagSpecifications: [{ ResourceType: "instance", Tags: [{ Key: "Name", Value: name }] }] } : {}),
      }),
    );
    ids = (res.Instances ?? []).map((i) => i.InstanceId!);
  } catch (e) {
    await flash("error", `Instance launch failed. ${errorMessage(e)}`);
    redirect("/ec2/instances/launch");
  }
  await flash("success", `Successfully initiated launch of instance (${ids.join(", ")}).`);
  redirect("/ec2/instances");
}

function stateAction(verb: string, run: (ids: string[]) => Promise<unknown>) {
  return async (fd: FormData) => {
    const ids = fd.getAll("selected").map(String);
    try {
      await run(ids);
      await flash("success", `Successfully ${verb} ${ids.join(", ")}.`);
    } catch (e) {
      await flash("error", `Failed to ${verb.replace(/ed$|ped$/, "")} instances. ${errorMessage(e)}`);
    }
    revalidatePath("/ec2/instances");
  };
}

export async function startInstances(fd: FormData) {
  const { ec2 } = await aws();
  return stateAction("started", (InstanceIds) => ec2.send(new StartInstancesCommand({ InstanceIds })))(fd);
}
export async function stopInstances(fd: FormData) {
  const { ec2 } = await aws();
  return stateAction("stopped", (InstanceIds) => ec2.send(new StopInstancesCommand({ InstanceIds })))(fd);
}
export async function rebootInstances(fd: FormData) {
  const { ec2 } = await aws();
  return stateAction("rebooted", (InstanceIds) => ec2.send(new RebootInstancesCommand({ InstanceIds })))(fd);
}
export async function terminateInstances(fd: FormData) {
  const { ec2 } = await aws();
  return stateAction("terminated", (InstanceIds) => ec2.send(new TerminateInstancesCommand({ InstanceIds })))(fd);
}

export async function createSecurityGroup(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { ec2 } = await aws();
    const vpc = String(fd.get("vpc") ?? "");
    await ec2.send(new CreateSecurityGroupCommand({ GroupName: name, Description: String(fd.get("description") || name), ...(vpc ? { VpcId: vpc } : {}) }));
    await flash("success", `Security group ${name} was created successfully.`);
  } catch (e) {
    await flash("error", `Failed to create security group. ${errorMessage(e)}`);
  }
  revalidatePath("/ec2/security-groups");
}

export async function deleteSecurityGroups(fd: FormData) {
  const { ec2 } = await aws();
  for (const id of fd.getAll("selected").map(String)) {
    try {
      await ec2.send(new DeleteSecurityGroupCommand({ GroupId: id }));
      await flash("success", `Deleted security group ${id}.`);
    } catch (e) {
      await flash("error", `Failed to delete ${id}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/ec2/security-groups");
}

export type KeyPairResult = { name?: string; material?: string; error?: string } | null;

export async function createKeyPair(_p: KeyPairResult, fd: FormData): Promise<KeyPairResult> {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { ec2 } = await aws();
    const res = await ec2.send(new CreateKeyPairCommand({ KeyName: name, KeyType: String(fd.get("type")) === "ed25519" ? "ed25519" : "rsa" }));
    revalidatePath("/ec2/key-pairs");
    return { name, material: res.KeyMaterial };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteKeyPairs(fd: FormData) {
  const { ec2 } = await aws();
  for (const n of fd.getAll("selected").map(String)) {
    try {
      await ec2.send(new DeleteKeyPairCommand({ KeyName: n }));
      await flash("success", `Successfully deleted key pair ${n}.`);
    } catch (e) {
      await flash("error", `Failed to delete key pair ${n}. ${errorMessage(e)}`);
    }
  }
  revalidatePath("/ec2/key-pairs");
}
