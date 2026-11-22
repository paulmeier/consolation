"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  AddRoleToInstanceProfileCommand,
  AddUserToGroupCommand,
  AttachGroupPolicyCommand,
  CreateAccountAliasCommand,
  CreateGroupCommand,
  CreateInstanceProfileCommand,
  CreateLoginProfileCommand,
  CreateOpenIDConnectProviderCommand,
  CreatePolicyVersionCommand,
  CreateSAMLProviderCommand,
  CreateServiceLinkedRoleCommand,
  CreateServiceSpecificCredentialCommand,
  DeleteAccountAliasCommand,
  DeleteAccountPasswordPolicyCommand,
  DeleteGroupCommand,
  DeleteGroupPolicyCommand,
  DeleteInstanceProfileCommand,
  DeleteLoginProfileCommand,
  DeleteOpenIDConnectProviderCommand,
  DeleteRolePermissionsBoundaryCommand,
  DeleteRolePolicyCommand,
  DeleteSAMLProviderCommand,
  DeleteServiceSpecificCredentialCommand,
  DeleteSigningCertificateCommand,
  DeleteSSHPublicKeyCommand,
  DeleteUserPermissionsBoundaryCommand,
  DeleteUserPolicyCommand,
  DetachGroupPolicyCommand,
  GenerateCredentialReportCommand,
  GetGroupCommand,
  ListAttachedGroupPoliciesCommand,
  ListGroupPoliciesCommand,
  PutGroupPolicyCommand,
  PutRolePermissionsBoundaryCommand,
  PutRolePolicyCommand,
  PutUserPermissionsBoundaryCommand,
  PutUserPolicyCommand,
  RemoveRoleFromInstanceProfileCommand,
  RemoveUserFromGroupCommand,
  SetDefaultPolicyVersionCommand,
  SetSecurityTokenServicePreferencesCommand,
  TagPolicyCommand,
  TagRoleCommand,
  TagUserCommand,
  UntagPolicyCommand,
  UntagRoleCommand,
  UntagUserCommand,
  UpdateAccessKeyCommand,
  UpdateAccountPasswordPolicyCommand,
  UpdateAssumeRolePolicyCommand,
  UpdateLoginProfileCommand,
  UpdateRoleCommand,
  UploadSigningCertificateCommand,
  UploadSSHPublicKeyCommand,
  ListUserPoliciesCommand,
  ListGroupsForUserCommand,
  ListSSHPublicKeysCommand,
  ListSigningCertificatesCommand,
  ListRolePoliciesCommand,
  ListInstanceProfilesForRoleCommand,
} from "@aws-sdk/client-iam";
import { AssumeRoleCommand, GetCallerIdentityCommand, GetSessionTokenCommand } from "@aws-sdk/client-sts";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";
import { guard, parseJson } from "@/lib/guard";

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
      for (const p of (await iam.send(new ListUserPoliciesCommand({ UserName: u }))).PolicyNames ?? []) await iam.send(new DeleteUserPolicyCommand({ UserName: u, PolicyName: p }));
      for (const g of (await iam.send(new ListGroupsForUserCommand({ UserName: u }))).Groups ?? []) await iam.send(new RemoveUserFromGroupCommand({ UserName: u, GroupName: g.GroupName! }));
      await iam.send(new DeleteLoginProfileCommand({ UserName: u })).catch(() => undefined);
      for (const k of (await iam.send(new ListSSHPublicKeysCommand({ UserName: u }))).SSHPublicKeys ?? []) await iam.send(new DeleteSSHPublicKeyCommand({ UserName: u, SSHPublicKeyId: k.SSHPublicKeyId! }));
      for (const c of (await iam.send(new ListSigningCertificatesCommand({ UserName: u }))).Certificates ?? []) await iam.send(new DeleteSigningCertificateCommand({ UserName: u, CertificateId: c.CertificateId! }));
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
      for (const p of (await iam.send(new ListRolePoliciesCommand({ RoleName: r }))).PolicyNames ?? []) await iam.send(new DeleteRolePolicyCommand({ RoleName: r, PolicyName: p }));
      // An instance profile holds one role, so it is empty afterwards: delete it too, as the console does.
      for (const ip of (await iam.send(new ListInstanceProfilesForRoleCommand({ RoleName: r }))).InstanceProfiles ?? []) {
        await iam.send(new RemoveRoleFromInstanceProfileCommand({ RoleName: r, InstanceProfileName: ip.InstanceProfileName! }));
        await iam.send(new DeleteInstanceProfileCommand({ InstanceProfileName: ip.InstanceProfileName! }));
      }
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
  if (fd.get("redirect")) redirect("/iam/policies");
}

// ---------------------------------------------------------------------------
// Groups, inline policies, boundaries, tags, policy versions, credentials,
// identity providers, account settings and STS.
// ---------------------------------------------------------------------------

type Kind = "user" | "group" | "role";
const kindPath = (kind: string, name: string) => `/iam/${kind}s/${encodeURIComponent(name)}`;

export async function createGroup(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  await guard(`User group ${name} created.`, "/iam/groups", async () => {
    const { iam } = await aws();
    await iam.send(new CreateGroupCommand({ GroupName: name }));
    for (const arn of fd.getAll("policies").map(String).filter(Boolean)) await iam.send(new AttachGroupPolicyCommand({ GroupName: name, PolicyArn: arn }));
  });
}

export async function deleteGroups(fd: FormData) {
  const { iam } = await aws();
  for (const g of fd.getAll("selected").map(String)) {
    await guard(`User group ${g} deleted.`, "/iam/groups", async () => {
      for (const u of (await iam.send(new GetGroupCommand({ GroupName: g }))).Users ?? []) await iam.send(new RemoveUserFromGroupCommand({ GroupName: g, UserName: u.UserName! }));
      for (const p of (await iam.send(new ListAttachedGroupPoliciesCommand({ GroupName: g }))).AttachedPolicies ?? []) await iam.send(new DetachGroupPolicyCommand({ GroupName: g, PolicyArn: p.PolicyArn! }));
      for (const p of (await iam.send(new ListGroupPoliciesCommand({ GroupName: g }))).PolicyNames ?? []) await iam.send(new DeleteGroupPolicyCommand({ GroupName: g, PolicyName: p }));
      await iam.send(new DeleteGroupCommand({ GroupName: g }));
    });
  }
  if (fd.get("redirect")) redirect("/iam/groups");
}

export async function addUsersToGroup(fd: FormData) {
  const group = String(fd.get("group"));
  await guard(`Users added to ${group}.`, kindPath("group", group), async () => {
    const { iam } = await aws();
    for (const u of fd.getAll("users").map(String)) await iam.send(new AddUserToGroupCommand({ GroupName: group, UserName: u }));
  });
}

export async function removeUsersFromGroup(fd: FormData) {
  const group = String(fd.get("group"));
  await guard(`Users removed from ${group}.`, kindPath("group", group), async () => {
    const { iam } = await aws();
    for (const u of fd.getAll("selected").map(String)) await iam.send(new RemoveUserFromGroupCommand({ GroupName: group, UserName: u }));
  });
}

export async function addUserToGroups(fd: FormData) {
  const user = String(fd.get("user"));
  await guard(`${user} added to groups.`, kindPath("user", user), async () => {
    const { iam } = await aws();
    for (const g of fd.getAll("groups").map(String)) await iam.send(new AddUserToGroupCommand({ GroupName: g, UserName: user }));
  });
}

export async function removeUserFromGroups(fd: FormData) {
  const user = String(fd.get("user"));
  await guard(`${user} removed from groups.`, kindPath("user", user), async () => {
    const { iam } = await aws();
    for (const g of fd.getAll("selected").map(String)) await iam.send(new RemoveUserFromGroupCommand({ GroupName: g, UserName: user }));
  });
}

export async function putInlinePolicy(fd: FormData) {
  const kind = String(fd.get("kind")) as Kind;
  const principal = String(fd.get("principal"));
  const PolicyName = String(fd.get("policyName")).trim();
  const PolicyDocument = String(fd.get("document") ?? "");
  await guard(`Inline policy ${PolicyName} saved.`, kindPath(kind, principal), async () => {
    parseJson(PolicyDocument, "Policy document");
    const { iam } = await aws();
    if (kind === "user") await iam.send(new PutUserPolicyCommand({ UserName: principal, PolicyName, PolicyDocument }));
    else if (kind === "group") await iam.send(new PutGroupPolicyCommand({ GroupName: principal, PolicyName, PolicyDocument }));
    else await iam.send(new PutRolePolicyCommand({ RoleName: principal, PolicyName, PolicyDocument }));
  });
}

export async function deleteInlinePolicies(fd: FormData) {
  const kind = String(fd.get("kind")) as Kind;
  const principal = String(fd.get("principal"));
  await guard("Inline policy deleted.", kindPath(kind, principal), async () => {
    const { iam } = await aws();
    for (const PolicyName of fd.getAll("selected").map(String)) {
      if (kind === "user") await iam.send(new DeleteUserPolicyCommand({ UserName: principal, PolicyName }));
      else if (kind === "group") await iam.send(new DeleteGroupPolicyCommand({ GroupName: principal, PolicyName }));
      else await iam.send(new DeleteRolePolicyCommand({ RoleName: principal, PolicyName }));
    }
  });
}

export async function setPermissionsBoundary(fd: FormData) {
  const kind = String(fd.get("kind")) as Kind;
  const principal = String(fd.get("principal"));
  const arn = String(fd.get("boundary") ?? "").trim();
  await guard(arn ? "Permissions boundary set." : "Permissions boundary removed.", kindPath(kind, principal), async () => {
    const { iam } = await aws();
    if (kind === "user" && arn) await iam.send(new PutUserPermissionsBoundaryCommand({ UserName: principal, PermissionsBoundary: arn }));
    else if (kind === "user") await iam.send(new DeleteUserPermissionsBoundaryCommand({ UserName: principal }));
    else if (arn) await iam.send(new PutRolePermissionsBoundaryCommand({ RoleName: principal, PermissionsBoundary: arn }));
    else await iam.send(new DeleteRolePermissionsBoundaryCommand({ RoleName: principal }));
  });
}

export async function tagIam(fd: FormData) {
  const kind = String(fd.get("kind"));
  const id = String(fd.get("id"));
  const Tags = [{ Key: String(fd.get("key")), Value: String(fd.get("value") ?? "") }];
  const path = kind === "policy" ? `/iam/policies/${encodeURIComponent(id)}` : kindPath(kind, id);
  await guard("Tag added.", path, async () => {
    const { iam } = await aws();
    if (kind === "user") await iam.send(new TagUserCommand({ UserName: id, Tags }));
    else if (kind === "role") await iam.send(new TagRoleCommand({ RoleName: id, Tags }));
    else await iam.send(new TagPolicyCommand({ PolicyArn: id, Tags }));
  });
}

export async function untagIam(fd: FormData) {
  const kind = String(fd.get("kind"));
  const id = String(fd.get("id"));
  const TagKeys = fd.getAll("selected").map(String);
  const path = kind === "policy" ? `/iam/policies/${encodeURIComponent(id)}` : kindPath(kind, id);
  await guard("Tags removed.", path, async () => {
    const { iam } = await aws();
    if (kind === "user") await iam.send(new UntagUserCommand({ UserName: id, TagKeys }));
    else if (kind === "role") await iam.send(new UntagRoleCommand({ RoleName: id, TagKeys }));
    else await iam.send(new UntagPolicyCommand({ PolicyArn: id, TagKeys }));
  });
}

export async function attachGroupPolicy(fd: FormData) {
  const group = String(fd.get("principal"));
  await guard(`Policy attached to ${group}.`, kindPath("group", group), async () => {
    const { iam } = await aws();
    await iam.send(new AttachGroupPolicyCommand({ GroupName: group, PolicyArn: String(fd.get("policy")).trim() }));
  });
}

export async function detachGroupPolicies(fd: FormData) {
  const group = String(fd.get("principal"));
  await guard("Policy removed.", kindPath("group", group), async () => {
    const { iam } = await aws();
    for (const arn of fd.getAll("selected").map(String)) await iam.send(new DetachGroupPolicyCommand({ GroupName: group, PolicyArn: arn }));
  });
}

// Policy versions
const polPath = (arn: string) => `/iam/policies/${encodeURIComponent(arn)}`;

export async function createPolicyVersion(fd: FormData) {
  const arn = String(fd.get("arn"));
  const doc = String(fd.get("document") ?? "");
  await guard("New policy version saved.", polPath(arn), async () => {
    parseJson(doc, "Policy document");
    const { iam } = await aws();
    const versions = (await iam.send(new ListPolicyVersionsCommand({ PolicyArn: arn }))).Versions ?? [];
    // IAM keeps at most 5 versions: drop the oldest non-default one first.
    if (versions.length >= 5) {
      const oldest = versions.filter((v) => !v.IsDefaultVersion).sort((a, b) => +(a.CreateDate ?? 0) - +(b.CreateDate ?? 0))[0];
      if (oldest) await iam.send(new DeletePolicyVersionCommand({ PolicyArn: arn, VersionId: oldest.VersionId! }));
    }
    await iam.send(new CreatePolicyVersionCommand({ PolicyArn: arn, PolicyDocument: doc, SetAsDefault: fd.get("setDefault") !== "off" }));
  });
}

export async function setDefaultPolicyVersion(fd: FormData) {
  const arn = String(fd.get("arn"));
  const v = String(fd.getAll("selected")[0] ?? "");
  await guard(`Version ${v} set as default.`, polPath(arn), async () => {
    const { iam } = await aws();
    await iam.send(new SetDefaultPolicyVersionCommand({ PolicyArn: arn, VersionId: v }));
  });
}

export async function deletePolicyVersions(fd: FormData) {
  const arn = String(fd.get("arn"));
  await guard("Policy version deleted.", polPath(arn), async () => {
    const { iam } = await aws();
    for (const v of fd.getAll("selected").map(String)) await iam.send(new DeletePolicyVersionCommand({ PolicyArn: arn, VersionId: v }));
  });
}

// Roles
export async function editRole(fd: FormData) {
  const role = String(fd.get("role"));
  await guard(`Role ${role} updated.`, kindPath("role", role), async () => {
    const { iam } = await aws();
    await iam.send(new UpdateRoleCommand({ RoleName: role, Description: String(fd.get("description") ?? ""), MaxSessionDuration: Number(fd.get("maxSession") || 1) * 3600 }));
  });
}

export async function updateTrustPolicy(fd: FormData) {
  const role = String(fd.get("role"));
  const doc = String(fd.get("document") ?? "");
  await guard("Trust policy updated.", kindPath("role", role), async () => {
    parseJson(doc, "Trust policy");
    const { iam } = await aws();
    await iam.send(new UpdateAssumeRolePolicyCommand({ RoleName: role, PolicyDocument: doc }));
  });
}

export async function createInstanceProfileForRole(fd: FormData) {
  const role = String(fd.get("role"));
  const name = String(fd.get("profile") || role).trim();
  await guard(`Instance profile ${name} created.`, kindPath("role", role), async () => {
    const { iam } = await aws();
    await iam.send(new CreateInstanceProfileCommand({ InstanceProfileName: name }));
    await iam.send(new AddRoleToInstanceProfileCommand({ InstanceProfileName: name, RoleName: role }));
  });
}

export async function deleteInstanceProfiles(fd: FormData) {
  const role = String(fd.get("role"));
  await guard("Instance profile deleted.", kindPath("role", role), async () => {
    const { iam } = await aws();
    for (const p of fd.getAll("selected").map(String)) {
      await iam.send(new RemoveRoleFromInstanceProfileCommand({ InstanceProfileName: p, RoleName: role }));
      await iam.send(new DeleteInstanceProfileCommand({ InstanceProfileName: p }));
    }
  });
}

export async function createServiceLinkedRole(fd: FormData) {
  const service = String(fd.get("service")).trim();
  await guard(`Service-linked role for ${service} created.`, "/iam/roles", async () => {
    const { iam } = await aws();
    await iam.send(new CreateServiceLinkedRoleCommand({ AWSServiceName: service, Description: String(fd.get("description") ?? "") || undefined, CustomSuffix: String(fd.get("suffix") ?? "") || undefined }));
  });
}

// User security credentials
export async function setAccessKeyStatus(fd: FormData) {
  const user = String(fd.get("user"));
  const status = fd.get("status") === "Active" ? "Active" : "Inactive";
  await guard(`Access key ${status === "Active" ? "activated" : "deactivated"}.`, kindPath("user", user), async () => {
    const { iam } = await aws();
    for (const id of fd.getAll("selected").map(String)) await iam.send(new UpdateAccessKeyCommand({ UserName: user, AccessKeyId: id, Status: status }));
  });
}

export async function setLoginProfile(fd: FormData) {
  const user = String(fd.get("user"));
  const password = String(fd.get("password") ?? "");
  const reset = fd.get("reset") === "on";
  await guard("Console password saved.", kindPath("user", user), async () => {
    const { iam } = await aws();
    if (fd.get("exists")) await iam.send(new UpdateLoginProfileCommand({ UserName: user, Password: password, PasswordResetRequired: reset }));
    else await iam.send(new CreateLoginProfileCommand({ UserName: user, Password: password, PasswordResetRequired: reset }));
  });
}

export async function deleteLoginProfile(fd: FormData) {
  const user = String(fd.get("user"));
  await guard("Console access disabled.", kindPath("user", user), async () => {
    const { iam } = await aws();
    await iam.send(new DeleteLoginProfileCommand({ UserName: user }));
  });
}

export async function uploadSshKey(fd: FormData) {
  const user = String(fd.get("user"));
  await guard("SSH public key uploaded.", kindPath("user", user), async () => {
    const { iam } = await aws();
    await iam.send(new UploadSSHPublicKeyCommand({ UserName: user, SSHPublicKeyBody: String(fd.get("key")).trim() }));
  });
}

export async function deleteSshKeys(fd: FormData) {
  const user = String(fd.get("user"));
  await guard("SSH public key deleted.", kindPath("user", user), async () => {
    const { iam } = await aws();
    for (const id of fd.getAll("selected").map(String)) await iam.send(new DeleteSSHPublicKeyCommand({ UserName: user, SSHPublicKeyId: id }));
  });
}

export type CredResult = { user?: string; password?: string; error?: string } | null;

export async function createServiceCredential(_p: CredResult, fd: FormData): Promise<CredResult> {
  const user = String(fd.get("user"));
  try {
    const { iam } = await aws();
    const c = (await iam.send(new CreateServiceSpecificCredentialCommand({ UserName: user, ServiceName: String(fd.get("service")) }))).ServiceSpecificCredential!;
    revalidatePath(kindPath("user", user));
    return { user: c.ServiceUserName, password: c.ServicePassword };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteServiceCredentials(fd: FormData) {
  const user = String(fd.get("user"));
  await guard("Service-specific credential deleted.", kindPath("user", user), async () => {
    const { iam } = await aws();
    for (const id of fd.getAll("selected").map(String)) await iam.send(new DeleteServiceSpecificCredentialCommand({ UserName: user, ServiceSpecificCredentialId: id }));
  });
}

export async function uploadSigningCert(fd: FormData) {
  const user = String(fd.get("user"));
  await guard("Signing certificate uploaded.", kindPath("user", user), async () => {
    const { iam } = await aws();
    await iam.send(new UploadSigningCertificateCommand({ UserName: user, CertificateBody: String(fd.get("cert")).trim() }));
  });
}

export async function deleteSigningCerts(fd: FormData) {
  const user = String(fd.get("user"));
  await guard("Signing certificate deleted.", kindPath("user", user), async () => {
    const { iam } = await aws();
    for (const id of fd.getAll("selected").map(String)) await iam.send(new DeleteSigningCertificateCommand({ UserName: user, CertificateId: id }));
  });
}

// Identity providers
const IDP = "/iam/identity-providers";

export async function createOidcProvider(fd: FormData) {
  const url = String(fd.get("url")).trim();
  await guard(`Identity provider ${url} added.`, IDP, async () => {
    const { iam } = await aws();
    const thumbs = String(fd.get("thumbprints") ?? "").split(/[\s,]+/).filter(Boolean);
    await iam.send(
      new CreateOpenIDConnectProviderCommand({
        Url: url,
        ClientIDList: String(fd.get("audiences") ?? "").split(/[\s,]+/).filter(Boolean),
        ThumbprintList: thumbs.length ? thumbs : undefined,
      }),
    );
  });
}

export async function createSamlProvider(fd: FormData) {
  const name = String(fd.get("name")).trim();
  await guard(`Identity provider ${name} added.`, IDP, async () => {
    const { iam } = await aws();
    await iam.send(new CreateSAMLProviderCommand({ Name: name, SAMLMetadataDocument: String(fd.get("metadata")) }));
  });
}

export async function deleteIdentityProviders(fd: FormData) {
  await guard("Identity provider deleted.", IDP, async () => {
    const { iam } = await aws();
    for (const arn of fd.getAll("selected").map(String)) {
      if (arn.includes(":oidc-provider/")) await iam.send(new DeleteOpenIDConnectProviderCommand({ OpenIDConnectProviderArn: arn }));
      else await iam.send(new DeleteSAMLProviderCommand({ SAMLProviderArn: arn }));
    }
  });
}

// Account settings
const ACCT = "/iam/account-settings";

export async function updatePasswordPolicy(fd: FormData) {
  const n = (k: string) => (String(fd.get(k) ?? "").trim() ? Number(fd.get(k)) : undefined);
  const b = (k: string) => fd.get(k) === "on";
  await guard("Password policy updated.", ACCT, async () => {
    const { iam } = await aws();
    await iam.send(
      new UpdateAccountPasswordPolicyCommand({
        MinimumPasswordLength: n("minLength"),
        RequireUppercaseCharacters: b("upper"),
        RequireLowercaseCharacters: b("lower"),
        RequireNumbers: b("numbers"),
        RequireSymbols: b("symbols"),
        AllowUsersToChangePassword: b("allowChange"),
        MaxPasswordAge: b("expire") ? n("maxAge") : undefined,
        PasswordReusePrevention: b("reuse") ? n("reuseCount") : undefined,
        HardExpiry: b("hardExpiry"),
      }),
    );
  });
}

export async function deletePasswordPolicy() {
  await guard("Password policy reset to the IAM default.", ACCT, async () => {
    const { iam } = await aws();
    await iam.send(new DeleteAccountPasswordPolicyCommand({}));
  });
}

export async function setAccountAlias(fd: FormData) {
  const alias = String(fd.get("alias") ?? "").trim();
  const old = String(fd.get("old") ?? "");
  await guard(alias ? `Account alias set to ${alias}.` : "Account alias deleted.", [ACCT, "/"], async () => {
    const { iam } = await aws();
    if (old) await iam.send(new DeleteAccountAliasCommand({ AccountAlias: old }));
    if (alias) await iam.send(new CreateAccountAliasCommand({ AccountAlias: alias }));
  });
}

export async function setStsPreferences(fd: FormData) {
  await guard("Security Token Service preferences saved.", ACCT, async () => {
    const { iam } = await aws();
    await iam.send(new SetSecurityTokenServicePreferencesCommand({ GlobalEndpointTokenVersion: fd.get("version") === "v2Token" ? "v2Token" : "v1Token" }));
  });
}

export async function generateCredentialReport() {
  await guard("Credential report requested. Refresh to download it when it's ready.", ACCT, async () => {
    const { iam } = await aws();
    await iam.send(new GenerateCredentialReportCommand({}));
  });
}

// STS playground
export type StsResult = { identity?: Record<string, string | undefined>; creds?: Record<string, string | undefined>; error?: string } | null;

export async function stsCall(_p: StsResult, fd: FormData): Promise<StsResult> {
  try {
    const { sts } = await aws();
    const op = String(fd.get("op"));
    if (op === "identity") {
      const r = await sts.send(new GetCallerIdentityCommand({}));
      return { identity: { Account: r.Account, Arn: r.Arn, UserId: r.UserId } };
    }
    const duration = Number(fd.get("duration") || 3600);
    if (op === "session") {
      const c = (await sts.send(new GetSessionTokenCommand({ DurationSeconds: Math.max(900, duration) }))).Credentials!;
      return { creds: { AccessKeyId: c.AccessKeyId, SecretAccessKey: c.SecretAccessKey, SessionToken: c.SessionToken, Expiration: c.Expiration?.toISOString() } };
    }
    const r = await sts.send(
      new AssumeRoleCommand({
        RoleArn: String(fd.get("role")),
        RoleSessionName: String(fd.get("session") || "consolation"),
        DurationSeconds: duration,
        Policy: String(fd.get("policy") ?? "").trim() || undefined,
      }),
    );
    const c = r.Credentials!;
    return {
      identity: { AssumedRoleArn: r.AssumedRoleUser?.Arn, AssumedRoleId: r.AssumedRoleUser?.AssumedRoleId },
      creds: { AccessKeyId: c.AccessKeyId, SecretAccessKey: c.SecretAccessKey, SessionToken: c.SessionToken, Expiration: c.Expiration?.toISOString() },
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
