"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CancelKeyDeletionCommand,
  CreateAliasCommand,
  CreateKeyCommand,
  DecryptCommand,
  DeleteAliasCommand,
  DisableKeyCommand,
  DisableKeyRotationCommand,
  EnableKeyCommand,
  EnableKeyRotationCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  GenerateMacCommand,
  PutKeyPolicyCommand,
  ScheduleKeyDeletionCommand,
  SignCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateKeyDescriptionCommand,
  VerifyCommand,
  VerifyMacCommand,
  type KeySpec,
  type KeyUsageType,
  type MacAlgorithmSpec,
  type SigningAlgorithmSpec,
} from "@aws-sdk/client-kms";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const keyPath = (id: string) => `/kms/keys/${encodeURIComponent(id)}`;

async function run(id: string, ok: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(keyPath(id));
  revalidatePath("/kms/keys");
}

export async function createKey(fd: FormData) {
  let keyId = "";
  try {
    const { kms } = await aws();
    const spec = String(fd.get("spec") ?? "SYMMETRIC_DEFAULT") as KeySpec;
    const usage = String(fd.get("usage") ?? "ENCRYPT_DECRYPT") as KeyUsageType;
    const r = await kms.send(new CreateKeyCommand({ KeySpec: spec, KeyUsage: usage, Description: String(fd.get("description") ?? ""), MultiRegion: fd.get("multiRegion") === "on" }));
    keyId = r.KeyMetadata!.KeyId!;
    const alias = String(fd.get("alias") ?? "").trim();
    if (alias) await kms.send(new CreateAliasCommand({ AliasName: alias.startsWith("alias/") ? alias : `alias/${alias}`, TargetKeyId: keyId }));
  } catch (e) {
    await flash("error", `Failed to create key. ${errorMessage(e)}`);
    redirect(keyId ? keyPath(keyId) : "/kms/keys/create");
  }
  await flash("success", `Your AWS KMS key was created with key ID ${keyId}.`);
  redirect(keyPath(keyId));
}

export async function setKeyEnabled(fd: FormData) {
  const id = String(fd.get("id"));
  const enable = fd.get("enable") === "true";
  const { kms } = await aws();
  await run(id, enable ? "Key enabled." : "Key disabled.", () => kms.send(enable ? new EnableKeyCommand({ KeyId: id }) : new DisableKeyCommand({ KeyId: id })));
}

export async function scheduleDeletion(fd: FormData) {
  const { kms } = await aws();
  const days = Math.min(30, Math.max(7, Number(fd.get("window") || 30)));
  for (const id of fd.getAll("selected").map(String)) {
    await run(id, `Key ${id} is scheduled for deletion in ${days} days.`, () => kms.send(new ScheduleKeyDeletionCommand({ KeyId: id, PendingWindowInDays: days })));
  }
}

export async function cancelDeletion(fd: FormData) {
  const id = String(fd.get("id"));
  const { kms } = await aws();
  await run(id, "Key deletion cancelled. The key is disabled; enable it to use it again.", () => kms.send(new CancelKeyDeletionCommand({ KeyId: id })));
}

export async function setRotation(fd: FormData) {
  const id = String(fd.get("id"));
  const enable = fd.get("enable") === "true";
  const days = Number(fd.get("days") || 365);
  const { kms } = await aws();
  await run(id, enable ? "Automatic key rotation enabled." : "Automatic key rotation disabled.", () =>
    kms.send(enable ? new EnableKeyRotationCommand({ KeyId: id, RotationPeriodInDays: days }) : new DisableKeyRotationCommand({ KeyId: id })),
  );
}

export async function addAlias(fd: FormData) {
  const id = String(fd.get("id"));
  const alias = String(fd.get("alias") ?? "").trim();
  const { kms } = await aws();
  await run(id, `Alias ${alias} created.`, () => kms.send(new CreateAliasCommand({ AliasName: alias.startsWith("alias/") ? alias : `alias/${alias}`, TargetKeyId: id })));
}

export async function deleteAliases(fd: FormData) {
  const id = String(fd.get("id"));
  const { kms } = await aws();
  for (const a of fd.getAll("selected").map(String)) await run(id, `Alias ${a} deleted.`, () => kms.send(new DeleteAliasCommand({ AliasName: a })));
}

export async function saveKeyPolicy(fd: FormData) {
  const id = String(fd.get("id"));
  const { kms } = await aws();
  await run(id, "Key policy saved.", async () => {
    const policy = String(fd.get("policy") ?? "");
    JSON.parse(policy);
    await kms.send(new PutKeyPolicyCommand({ KeyId: id, PolicyName: "default", Policy: policy }));
  });
}

export async function saveDescription(fd: FormData) {
  const id = String(fd.get("id"));
  const { kms } = await aws();
  await run(id, "Description updated.", () => kms.send(new UpdateKeyDescriptionCommand({ KeyId: id, Description: String(fd.get("description") ?? "") })));
}

export async function tagKey(fd: FormData) {
  const id = String(fd.get("id"));
  const { kms } = await aws();
  await run(id, "Tag added.", () => kms.send(new TagResourceCommand({ KeyId: id, Tags: [{ TagKey: String(fd.get("key")), TagValue: String(fd.get("value") ?? "") }] })));
}

export async function untagKey(fd: FormData) {
  const id = String(fd.get("id"));
  const { kms } = await aws();
  await run(id, "Tags removed.", () => kms.send(new UntagResourceCommand({ KeyId: id, TagKeys: fd.getAll("selected").map(String) })));
}

export type CryptoResult = { output?: string; detail?: string; error?: string } | null;

const b64 = (u?: Uint8Array) => (u ? Buffer.from(u).toString("base64") : "");

/** Cryptography playground for one key: encrypt, decrypt, data key, sign/verify, MAC. */
export async function cryptoOp(_p: CryptoResult, fd: FormData): Promise<CryptoResult> {
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  const input = String(fd.get("input") ?? "");
  const alg = String(fd.get("alg") ?? "");
  try {
    const { kms } = await aws();
    switch (op) {
      case "encrypt": {
        const r = await kms.send(new EncryptCommand({ KeyId: id, Plaintext: Buffer.from(input, "utf8") }));
        return { output: b64(r.CiphertextBlob), detail: "Ciphertext (base64). Paste it into Decrypt to round-trip." };
      }
      case "decrypt": {
        const r = await kms.send(new DecryptCommand({ KeyId: id, CiphertextBlob: Buffer.from(input.trim(), "base64") }));
        return { output: Buffer.from(r.Plaintext ?? new Uint8Array()).toString("utf8"), detail: `Decrypted with ${r.KeyId}` };
      }
      case "datakey": {
        const r = await kms.send(new GenerateDataKeyCommand({ KeyId: id, KeySpec: "AES_256" }));
        return { output: `Plaintext: ${b64(r.Plaintext)}\nCiphertextBlob: ${b64(r.CiphertextBlob)}`, detail: "AES-256 data key (base64)." };
      }
      case "sign": {
        const r = await kms.send(new SignCommand({ KeyId: id, Message: Buffer.from(input, "utf8"), MessageType: "RAW", SigningAlgorithm: alg as SigningAlgorithmSpec }));
        return { output: b64(r.Signature), detail: `Signature (${r.SigningAlgorithm}, base64).` };
      }
      case "verify": {
        const [message, signature] = input.split(/\r?\n---\r?\n/);
        const r = await kms.send(new VerifyCommand({ KeyId: id, Message: Buffer.from(message ?? "", "utf8"), MessageType: "RAW", Signature: Buffer.from((signature ?? "").trim(), "base64"), SigningAlgorithm: alg as SigningAlgorithmSpec }));
        return { output: r.SignatureValid ? "Signature is valid" : "Signature is NOT valid" };
      }
      case "mac": {
        const r = await kms.send(new GenerateMacCommand({ KeyId: id, Message: Buffer.from(input, "utf8"), MacAlgorithm: alg as MacAlgorithmSpec }));
        return { output: b64(r.Mac), detail: `MAC (${r.MacAlgorithm}, base64).` };
      }
      case "verifymac": {
        const [message, mac] = input.split(/\r?\n---\r?\n/);
        const r = await kms.send(new VerifyMacCommand({ KeyId: id, Message: Buffer.from(message ?? "", "utf8"), Mac: Buffer.from((mac ?? "").trim(), "base64"), MacAlgorithm: alg as MacAlgorithmSpec }));
        return { output: r.MacValid ? "MAC is valid" : "MAC is NOT valid" };
      }
    }
    return { error: `Unknown operation ${op}` };
  } catch (e) {
    const name = (e as Error).name;
    if (name === "KMSInvalidSignatureException") return { output: "Signature is NOT valid" };
    if (name === "KMSInvalidMacException") return { output: "MAC is NOT valid" };
    return { error: errorMessage(e) };
  }
}
