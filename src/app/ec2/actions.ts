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
  AllocateAddressCommand,
  AssociateAddressCommand,
  AttachNetworkInterfaceCommand,
  AttachVolumeCommand,
  AuthorizeSecurityGroupEgressCommand,
  AuthorizeSecurityGroupIngressCommand,
  CopyImageCommand,
  CopySnapshotCommand,
  CreateImageCommand,
  CreateLaunchTemplateCommand,
  CreateLaunchTemplateVersionCommand,
  CreateNetworkInterfaceCommand,
  CreatePlacementGroupCommand,
  CreateSnapshotCommand,
  CreateTagsCommand,
  CreateVolumeCommand,
  DeleteLaunchTemplateCommand,
  DeleteNetworkInterfaceCommand,
  DeletePlacementGroupCommand,
  DeleteSnapshotCommand,
  DeleteTagsCommand,
  DeleteVolumeCommand,
  DeregisterImageCommand,
  DetachNetworkInterfaceCommand,
  DetachVolumeCommand,
  DisassociateAddressCommand,
  ModifyInstanceAttributeCommand,
  ModifyLaunchTemplateCommand,
  ReleaseAddressCommand,
  RevokeSecurityGroupEgressCommand,
  RevokeSecurityGroupIngressCommand,
  type IpPermission,
  type PlacementStrategy,
  type VolumeType,
} from "@aws-sdk/client-ec2";
import { SendSerialConsoleSSHPublicKeyCommand, SendSSHPublicKeyCommand } from "@aws-sdk/client-ec2-instance-connect";
import { aws, errorMessage, REGION } from "@/lib/emulator";
import { flash } from "@/lib/flash";
import { guard } from "@/lib/guard";

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
        ...(fd.get("userData") ? { UserData: Buffer.from(String(fd.get("userData")), "utf8").toString("base64") } : {}),
        ...(fd.get("placement") ? { Placement: { GroupName: String(fd.get("placement")) } } : {}),
        ...(fd.get("protect") === "on" ? { DisableApiTermination: true } : {}),
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

// ---------------------------------------------------------------------------
// Instance details, AMIs, EBS, launch templates, Elastic IPs, ENIs, placement
// groups, security group rules, tags and EC2 Instance Connect.
// ---------------------------------------------------------------------------

const instPath = (id: string) => `/ec2/instances/${id}`;

export async function setTags(fd: FormData) {
  const id = String(fd.get("resource"));
  const path = String(fd.get("path"));
  await guard("Tag added.", path, async () => {
    const { ec2 } = await aws();
    await ec2.send(new CreateTagsCommand({ Resources: [id], Tags: [{ Key: String(fd.get("key")), Value: String(fd.get("value") ?? "") }] }));
  });
}

export async function removeTags(fd: FormData) {
  const id = String(fd.get("resource"));
  const path = String(fd.get("path"));
  await guard("Tags removed.", path, async () => {
    const { ec2 } = await aws();
    await ec2.send(new DeleteTagsCommand({ Resources: [id], Tags: fd.getAll("selected").map((Key) => ({ Key: String(Key) })) }));
  });
}

export async function instanceStateAction(fd: FormData) {
  const id = String(fd.get("instance"));
  const op = String(fd.get("op"));
  await guard(`Successfully requested ${op} of ${id}.`, [instPath(id), "/ec2/instances"], async () => {
    const { ec2 } = await aws();
    const InstanceIds = [id];
    if (op === "start") await ec2.send(new StartInstancesCommand({ InstanceIds }));
    else if (op === "stop") await ec2.send(new StopInstancesCommand({ InstanceIds }));
    else if (op === "reboot") await ec2.send(new RebootInstancesCommand({ InstanceIds }));
    else if (op === "terminate") await ec2.send(new TerminateInstancesCommand({ InstanceIds }));
  });
}

export async function changeInstanceType(fd: FormData) {
  const id = String(fd.get("instance"));
  await guard(`Instance type of ${id} changed.`, instPath(id), async () => {
    const { ec2 } = await aws();
    await ec2.send(new ModifyInstanceAttributeCommand({ InstanceId: id, InstanceType: { Value: String(fd.get("type")) } }));
  });
}

export async function editUserData(fd: FormData) {
  const id = String(fd.get("instance"));
  await guard(`User data of ${id} saved.`, instPath(id), async () => {
    const { ec2 } = await aws();
    await ec2.send(new ModifyInstanceAttributeCommand({ InstanceId: id, UserData: { Value: new TextEncoder().encode(String(fd.get("userData") ?? "")) } }));
  });
}

export async function changeSecurityGroups(fd: FormData) {
  const id = String(fd.get("instance"));
  await guard(`Security groups of ${id} changed.`, instPath(id), async () => {
    const { ec2 } = await aws();
    await ec2.send(new ModifyInstanceAttributeCommand({ InstanceId: id, Groups: fd.getAll("groups").map(String) }));
  });
}

export async function setTerminationProtection(fd: FormData) {
  const id = String(fd.get("instance"));
  const on = fd.get("on") === "true";
  await guard(`Termination protection ${on ? "enabled" : "disabled"}.`, instPath(id), async () => {
    const { ec2 } = await aws();
    await ec2.send(new ModifyInstanceAttributeCommand({ InstanceId: id, DisableApiTermination: { Value: on } }));
  });
}

export async function createImage(fd: FormData) {
  const id = String(fd.get("instance"));
  const name = String(fd.get("name")).trim();
  await guard(`Image ${name} is being created.`, [instPath(id), "/ec2/amis"], async () => {
    const { ec2 } = await aws();
    await ec2.send(new CreateImageCommand({ InstanceId: id, Name: name, Description: String(fd.get("description") ?? "") || undefined, NoReboot: fd.get("noReboot") === "on" }));
  });
}

export async function deregisterImages(fd: FormData) {
  await guard("AMI deregistered.", "/ec2/amis", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new DeregisterImageCommand({ ImageId: id }));
  });
}

export async function copyImage(fd: FormData) {
  await guard("AMI copy started.", "/ec2/amis", async () => {
    const { ec2 } = await aws();
    await ec2.send(new CopyImageCommand({ SourceImageId: String(fd.get("image")), SourceRegion: REGION, Name: String(fd.get("name")).trim() }));
  });
}

export async function launchFromImage(fd: FormData) {
  const image = String(fd.get("image") ?? fd.getAll("selected")[0] ?? "");
  redirect(`/ec2/instances/launch?ami=${encodeURIComponent(image)}`);
}

// EBS
export async function createVolume(fd: FormData) {
  await guard("Volume created.", "/ec2/volumes", async () => {
    const { ec2 } = await aws();
    const type = String(fd.get("type") || "gp3") as VolumeType;
    const snapshot = String(fd.get("snapshot") ?? "");
    const iops = String(fd.get("iops") ?? "").trim();
    const name = String(fd.get("name") ?? "").trim();
    await ec2.send(
      new CreateVolumeCommand({
        AvailabilityZone: String(fd.get("az")),
        VolumeType: type,
        ...(snapshot ? { SnapshotId: snapshot } : { Size: Number(fd.get("size") || 8) }),
        ...(iops && ["io1", "io2", "gp3"].includes(type) ? { Iops: Number(iops) } : {}),
        Encrypted: fd.get("encrypted") === "on",
        ...(name ? { TagSpecifications: [{ ResourceType: "volume", Tags: [{ Key: "Name", Value: name }] }] } : {}),
      }),
    );
  });
}

export async function deleteVolumes(fd: FormData) {
  await guard("Volume deleted.", "/ec2/volumes", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new DeleteVolumeCommand({ VolumeId: id }));
  });
}

export async function attachVolume(fd: FormData) {
  await guard("Volume attached.", "/ec2/volumes", async () => {
    const { ec2 } = await aws();
    await ec2.send(new AttachVolumeCommand({ VolumeId: String(fd.get("volume")), InstanceId: String(fd.get("instance")), Device: String(fd.get("device") || "/dev/sdf") }));
  });
}

export async function detachVolumes(fd: FormData) {
  await guard("Volume detached.", "/ec2/volumes", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new DetachVolumeCommand({ VolumeId: id, Force: fd.get("force") === "on" }));
  });
}

export async function createSnapshot(fd: FormData) {
  await guard("Snapshot created.", ["/ec2/snapshots", "/ec2/volumes"], async () => {
    const { ec2 } = await aws();
    await ec2.send(new CreateSnapshotCommand({ VolumeId: String(fd.get("volume")), Description: String(fd.get("description") ?? "") || undefined }));
  });
}

export async function copySnapshot(fd: FormData) {
  await guard("Snapshot copy started.", "/ec2/snapshots", async () => {
    const { ec2 } = await aws();
    await ec2.send(new CopySnapshotCommand({ SourceSnapshotId: String(fd.get("snapshot")), SourceRegion: REGION, Description: String(fd.get("description") ?? "") || undefined, Encrypted: fd.get("encrypted") === "on" }));
  });
}

export async function deleteSnapshots(fd: FormData) {
  await guard("Snapshot deleted.", "/ec2/snapshots", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new DeleteSnapshotCommand({ SnapshotId: id }));
  });
}

// Launch templates
function templateData(fd: FormData) {
  const sg = fd.getAll("groups").map(String).filter(Boolean);
  const key = String(fd.get("key") ?? "");
  const userData = String(fd.get("userData") ?? "");
  return {
    ImageId: String(fd.get("ami") ?? "") || undefined,
    InstanceType: (String(fd.get("type") ?? "") || undefined) as _InstanceType | undefined,
    ...(key ? { KeyName: key } : {}),
    ...(sg.length ? { SecurityGroupIds: sg } : {}),
    ...(userData ? { UserData: Buffer.from(userData, "utf8").toString("base64") } : {}),
  };
}

export async function createLaunchTemplate(fd: FormData) {
  const name = String(fd.get("name")).trim();
  await guard(`Launch template ${name} created.`, "/ec2/launch-templates", async () => {
    const { ec2 } = await aws();
    await ec2.send(new CreateLaunchTemplateCommand({ LaunchTemplateName: name, VersionDescription: String(fd.get("description") ?? "") || undefined, LaunchTemplateData: templateData(fd) }));
  });
}

export async function createLaunchTemplateVersion(fd: FormData) {
  const id = String(fd.get("template"));
  await guard("New template version created.", `/ec2/launch-templates/${id}`, async () => {
    const { ec2 } = await aws();
    await ec2.send(new CreateLaunchTemplateVersionCommand({ LaunchTemplateId: id, SourceVersion: String(fd.get("source") ?? "") || undefined, VersionDescription: String(fd.get("description") ?? "") || undefined, LaunchTemplateData: templateData(fd) }));
  });
}

export async function setDefaultTemplateVersion(fd: FormData) {
  const id = String(fd.get("template"));
  const v = String(fd.getAll("selected")[0] ?? "");
  await guard(`Version ${v} is now the default.`, `/ec2/launch-templates/${id}`, async () => {
    const { ec2 } = await aws();
    await ec2.send(new ModifyLaunchTemplateCommand({ LaunchTemplateId: id, DefaultVersion: v }));
  });
}

export async function deleteLaunchTemplates(fd: FormData) {
  await guard("Launch template deleted.", "/ec2/launch-templates", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new DeleteLaunchTemplateCommand({ LaunchTemplateId: id }));
  });
  if (fd.get("redirect")) redirect("/ec2/launch-templates");
}

export async function launchFromTemplate(fd: FormData) {
  const id = String(fd.get("template"));
  let ids: string[] = [];
  const ok = await guard("Instance launched from template.", ["/ec2/instances", `/ec2/launch-templates/${id}`], async () => {
    const { ec2 } = await aws();
    const count = Math.max(1, Math.min(10, Number(fd.get("count") || 1)));
    const r = await ec2.send(new RunInstancesCommand({ MinCount: count, MaxCount: count, LaunchTemplate: { LaunchTemplateId: id, Version: String(fd.get("version") || "$Default") } }));
    ids = (r.Instances ?? []).map((i) => i.InstanceId!);
  });
  if (ok && ids.length === 1) redirect(instPath(ids[0]));
}

// Elastic IPs
export async function allocateAddress(fd: FormData) {
  await guard("Elastic IP address allocated.", "/ec2/elastic-ips", async () => {
    const { ec2 } = await aws();
    const name = String(fd.get("name") ?? "").trim();
    await ec2.send(new AllocateAddressCommand({ Domain: "vpc", ...(name ? { TagSpecifications: [{ ResourceType: "elastic-ip", Tags: [{ Key: "Name", Value: name }] }] } : {}) }));
  });
}

export async function associateAddress(fd: FormData) {
  await guard("Elastic IP address associated.", "/ec2/elastic-ips", async () => {
    const { ec2 } = await aws();
    const target = String(fd.get("target"));
    await ec2.send(
      new AssociateAddressCommand({
        AllocationId: String(fd.get("allocation")),
        ...(target.startsWith("eni-") ? { NetworkInterfaceId: target } : { InstanceId: target }),
        AllowReassociation: fd.get("reassociate") === "on",
      }),
    );
  });
}

export async function disassociateAddresses(fd: FormData) {
  await guard("Elastic IP address disassociated.", "/ec2/elastic-ips", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new DisassociateAddressCommand({ AssociationId: id }));
  });
}

export async function releaseAddresses(fd: FormData) {
  await guard("Elastic IP address released.", "/ec2/elastic-ips", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new ReleaseAddressCommand({ AllocationId: id }));
  });
}

// Network interfaces
export async function createNetworkInterface(fd: FormData) {
  await guard("Network interface created.", "/ec2/network-interfaces", async () => {
    const { ec2 } = await aws();
    const sg = fd.getAll("groups").map(String).filter(Boolean);
    await ec2.send(new CreateNetworkInterfaceCommand({ SubnetId: String(fd.get("subnet")), Description: String(fd.get("description") ?? "") || undefined, ...(sg.length ? { Groups: sg } : {}) }));
  });
}

export async function deleteNetworkInterfaces(fd: FormData) {
  await guard("Network interface deleted.", "/ec2/network-interfaces", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new DeleteNetworkInterfaceCommand({ NetworkInterfaceId: id }));
  });
}

export async function attachNetworkInterface(fd: FormData) {
  await guard("Network interface attached.", "/ec2/network-interfaces", async () => {
    const { ec2 } = await aws();
    await ec2.send(new AttachNetworkInterfaceCommand({ NetworkInterfaceId: String(fd.get("eni")), InstanceId: String(fd.get("instance")), DeviceIndex: Number(fd.get("index") || 1) }));
  });
}

export async function detachNetworkInterfaces(fd: FormData) {
  await guard("Network interface detached.", "/ec2/network-interfaces", async () => {
    const { ec2 } = await aws();
    for (const id of fd.getAll("selected").map(String)) await ec2.send(new DetachNetworkInterfaceCommand({ AttachmentId: id, Force: true }));
  });
}

// Placement groups
export async function createPlacementGroup(fd: FormData) {
  const name = String(fd.get("name")).trim();
  await guard(`Placement group ${name} created.`, "/ec2/placement-groups", async () => {
    const { ec2 } = await aws();
    const strategy = String(fd.get("strategy")) as PlacementStrategy;
    await ec2.send(new CreatePlacementGroupCommand({ GroupName: name, Strategy: strategy, ...(strategy === "partition" ? { PartitionCount: Number(fd.get("partitions") || 2) } : {}) }));
  });
}

export async function deletePlacementGroups(fd: FormData) {
  await guard("Placement group deleted.", "/ec2/placement-groups", async () => {
    const { ec2 } = await aws();
    for (const n of fd.getAll("selected").map(String)) await ec2.send(new DeletePlacementGroupCommand({ GroupName: n }));
  });
}

// Security group rules
const sgPath = (id: string) => `/ec2/security-groups/${id}`;

export async function addSecurityGroupRule(fd: FormData) {
  const id = String(fd.get("group"));
  const dir = String(fd.get("direction"));
  await guard(`${dir === "egress" ? "Outbound" : "Inbound"} rule added.`, sgPath(id), async () => {
    const { ec2 } = await aws();
    const protocol = String(fd.get("protocol"));
    const from = String(fd.get("from") ?? "").trim();
    const to = String(fd.get("to") ?? "").trim() || from;
    const source = String(fd.get("source") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim() || undefined;
    const perm: IpPermission = {
      IpProtocol: protocol,
      ...(protocol === "-1" ? {} : { FromPort: Number(from || 0), ToPort: Number(to || from || 0) }),
      ...(source.startsWith("sg-")
        ? { UserIdGroupPairs: [{ GroupId: source, Description: description }] }
        : source.includes(":")
          ? { Ipv6Ranges: [{ CidrIpv6: source, Description: description }] }
          : source.startsWith("pl-")
            ? { PrefixListIds: [{ PrefixListId: source, Description: description }] }
            : { IpRanges: [{ CidrIp: source || "0.0.0.0/0", Description: description }] }),
    };
    if (dir === "egress") await ec2.send(new AuthorizeSecurityGroupEgressCommand({ GroupId: id, IpPermissions: [perm] }));
    else await ec2.send(new AuthorizeSecurityGroupIngressCommand({ GroupId: id, IpPermissions: [perm] }));
  });
}

export async function removeSecurityGroupRules(fd: FormData) {
  const id = String(fd.get("group"));
  const dir = String(fd.get("direction"));
  await guard("Rules removed.", sgPath(id), async () => {
    const { ec2 } = await aws();
    const SecurityGroupRuleIds = fd.getAll("selected").map(String);
    if (dir === "egress") await ec2.send(new RevokeSecurityGroupEgressCommand({ GroupId: id, SecurityGroupRuleIds }));
    else await ec2.send(new RevokeSecurityGroupIngressCommand({ GroupId: id, SecurityGroupRuleIds }));
  });
}

// EC2 Instance Connect
export type ConnectResult = { ok?: string; error?: string } | null;

export async function sendSshPublicKey(_p: ConnectResult, fd: FormData): Promise<ConnectResult> {
  try {
    const { ec2Connect } = await aws();
    const serial = fd.get("serial") === "on";
    const InstanceId = String(fd.get("instance"));
    const SSHPublicKey = String(fd.get("key") ?? "").trim();
    if (serial) {
      const r = await ec2Connect.send(new SendSerialConsoleSSHPublicKeyCommand({ InstanceId, SSHPublicKey, SerialPort: 0 }));
      return { ok: `Serial console key accepted (request ${r.RequestId}). It is valid for 60 seconds.` };
    }
    const r = await ec2Connect.send(new SendSSHPublicKeyCommand({ InstanceId, InstanceOSUser: String(fd.get("user") || "ec2-user"), SSHPublicKey, AvailabilityZone: String(fd.get("az") ?? "") || undefined }));
    return { ok: `Key pushed (request ${r.RequestId}). It is valid for 60 seconds. The emulator runs no SSH server, so there is nothing to connect to.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
