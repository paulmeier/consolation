"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminResetUserPasswordCommand,
  CreateGroupCommand,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  CreateUserPoolDomainCommand,
  DeleteGroupCommand,
  DeleteUserPoolClientCommand,
  DeleteUserPoolCommand,
  DeleteUserPoolDomainCommand,
  type ExplicitAuthFlowsType,
} from "@aws-sdk/client-cognito-identity-provider";
import { CreateIdentityPoolCommand, DeleteIdentityPoolCommand } from "@aws-sdk/client-cognito-identity";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const pp = (id: string) => `/cognito/user-pools/${id}`;

async function guard(ok: string, paths: string[], fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  paths.forEach((p) => revalidatePath(p));
}

export async function createUserPool(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  let id = "";
  try {
    const { cognito } = await aws();
    const signIn = String(fd.get("signIn") ?? "email");
    const r = await cognito.send(
      new CreateUserPoolCommand({
        PoolName: name,
        ...(signIn === "email" ? { UsernameAttributes: ["email"], AutoVerifiedAttributes: ["email"] } : {}),
        MfaConfiguration: "OFF",
        Policies: { PasswordPolicy: { MinimumLength: Number(fd.get("minLength") || 8), RequireUppercase: true, RequireLowercase: true, RequireNumbers: true, RequireSymbols: false } },
        DeletionProtection: fd.get("protect") === "on" ? "ACTIVE" : "INACTIVE",
      }),
    );
    id = r.UserPool!.Id!;
    const client = String(fd.get("client") ?? "").trim();
    if (client) await cognito.send(new CreateUserPoolClientCommand({ UserPoolId: id, ClientName: client, ExplicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_SRP_AUTH"] }));
  } catch (e) {
    await flash("error", `Failed to create user pool ${name}. ${errorMessage(e)}`);
    revalidatePath("/cognito/user-pools");
    return;
  }
  await flash("success", `User pool ${name} has been created successfully.`);
  redirect(pp(id));
}

export async function deleteUserPools(fd: FormData) {
  const { cognito } = await aws();
  for (const id of fd.getAll("selected").map(String)) await guard(`User pool ${id} deleted.`, ["/cognito/user-pools"], () => cognito.send(new DeleteUserPoolCommand({ UserPoolId: id })));
  if (fd.get("from") === "detail") redirect("/cognito/user-pools");
}

export async function createUser(fd: FormData) {
  const pool = String(fd.get("pool"));
  const { cognito } = await aws();
  await guard("User created.", [pp(pool)], async () => {
    const email = String(fd.get("email") ?? "").trim();
    const username = String(fd.get("username") ?? "").trim() || email;
    const temp = String(fd.get("tempPassword") ?? "");
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: pool,
        Username: username,
        UserAttributes: email ? [{ Name: "email", Value: email }, { Name: "email_verified", Value: fd.get("verified") === "on" ? "true" : "false" }] : undefined,
        ...(temp ? { TemporaryPassword: temp } : {}),
        MessageAction: "SUPPRESS",
      }),
    );
  });
}

export async function userAction(fd: FormData) {
  const pool = String(fd.get("pool"));
  const op = String(fd.get("op"));
  const { cognito } = await aws();
  for (const u of fd.getAll("selected").map(String)) {
    const args = { UserPoolId: pool, Username: u };
    await guard(`${op[0].toUpperCase()}${op.slice(1)}: ${u}.`, [pp(pool)], () => {
      switch (op) {
        case "enable":
          return cognito.send(new AdminEnableUserCommand(args));
        case "disable":
          return cognito.send(new AdminDisableUserCommand(args));
        case "confirm":
          return cognito.send(new AdminConfirmSignUpCommand(args));
        case "reset password":
          return cognito.send(new AdminResetUserPasswordCommand(args));
        case "delete":
          return cognito.send(new AdminDeleteUserCommand(args));
        default:
          return Promise.reject(new Error(`Unknown operation ${op}`));
      }
    });
  }
}

export async function addToGroup(fd: FormData) {
  const pool = String(fd.get("pool"));
  const { cognito } = await aws();
  const group = String(fd.get("group"));
  for (const u of fd.getAll("selected").map(String)) await guard(`Added ${u} to ${group}.`, [pp(pool)], () => cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: pool, Username: u, GroupName: group })));
}

export async function removeFromGroup(fd: FormData) {
  const pool = String(fd.get("pool"));
  const { cognito } = await aws();
  await guard("Removed from group.", [pp(pool)], () => cognito.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: pool, Username: String(fd.get("user")), GroupName: String(fd.get("group")) })));
}

export async function createGroup(fd: FormData) {
  const pool = String(fd.get("pool"));
  const { cognito } = await aws();
  await guard("Group created.", [pp(pool)], () =>
    cognito.send(new CreateGroupCommand({ UserPoolId: pool, GroupName: String(fd.get("name")), Description: String(fd.get("description") ?? "") || undefined, Precedence: Number(fd.get("precedence") || 0) || undefined })),
  );
}

export async function deleteGroups(fd: FormData) {
  const pool = String(fd.get("pool"));
  const { cognito } = await aws();
  for (const g of fd.getAll("selected").map(String)) await guard(`Group ${g} deleted.`, [pp(pool)], () => cognito.send(new DeleteGroupCommand({ UserPoolId: pool, GroupName: g })));
}

export async function createClient(fd: FormData) {
  const pool = String(fd.get("pool"));
  const { cognito } = await aws();
  await guard("App client created.", [pp(pool)], () =>
    cognito.send(
      new CreateUserPoolClientCommand({
        UserPoolId: pool,
        ClientName: String(fd.get("name")),
        GenerateSecret: fd.get("secret") === "on",
        ExplicitAuthFlows: fd.getAll("flows").map(String) as ExplicitAuthFlowsType[],
        CallbackURLs: String(fd.get("callback") ?? "").trim() ? [String(fd.get("callback")).trim()] : undefined,
      }),
    ),
  );
}

export async function deleteClients(fd: FormData) {
  const pool = String(fd.get("pool"));
  const { cognito } = await aws();
  for (const c of fd.getAll("selected").map(String)) await guard("App client deleted.", [pp(pool)], () => cognito.send(new DeleteUserPoolClientCommand({ UserPoolId: pool, ClientId: c })));
}

export async function setDomain(fd: FormData) {
  const pool = String(fd.get("pool"));
  const { cognito } = await aws();
  const existing = String(fd.get("existing") ?? "");
  await guard(existing ? "Domain deleted." : "Domain created.", [pp(pool)], () =>
    existing ? cognito.send(new DeleteUserPoolDomainCommand({ UserPoolId: pool, Domain: existing })) : cognito.send(new CreateUserPoolDomainCommand({ UserPoolId: pool, Domain: String(fd.get("domain")).trim() })),
  );
}

export async function createIdentityPool(fd: FormData) {
  const { cognitoIdentity } = await aws();
  await guard("Identity pool created.", ["/cognito/identity-pools"], () => {
    const pool = String(fd.get("userPool") ?? "");
    const [poolId, clientId] = pool.split("|");
    return cognitoIdentity.send(
      new CreateIdentityPoolCommand({
        IdentityPoolName: String(fd.get("name")),
        AllowUnauthenticatedIdentities: fd.get("guest") === "on",
        ...(poolId && clientId ? { CognitoIdentityProviders: [{ ProviderName: `cognito-idp.us-east-1.amazonaws.com/${poolId}`, ClientId: clientId }] } : {}),
      }),
    );
  });
}

export async function deleteIdentityPools(fd: FormData) {
  const { cognitoIdentity } = await aws();
  for (const id of fd.getAll("selected").map(String)) await guard(`Identity pool ${id} deleted.`, ["/cognito/identity-pools"], () => cognitoIdentity.send(new DeleteIdentityPoolCommand({ IdentityPoolId: id })));
}
