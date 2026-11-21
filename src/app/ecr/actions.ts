"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  BatchDeleteImageCommand,
  CreateRepositoryCommand,
  DeleteLifecyclePolicyCommand,
  DeleteRepositoryCommand,
  DeleteRepositoryPolicyCommand,
  PutImageScanningConfigurationCommand,
  PutImageTagMutabilityCommand,
  PutLifecyclePolicyCommand,
  SetRepositoryPolicyCommand,
  StartImageScanCommand,
  type ImageTagMutability,
} from "@aws-sdk/client-ecr";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const rp = (n: string) => `/ecr/repositories/${encodeURIComponent(n)}`;

async function guard(ok: string, path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(path);
}

export async function createRepository(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const { ecr } = await aws();
  await guard(`Successfully created private repository, ${name}.`, "/ecr/repositories", () =>
    ecr.send(
      new CreateRepositoryCommand({
        repositoryName: name,
        imageTagMutability: String(fd.get("mutability") ?? "MUTABLE") as ImageTagMutability,
        imageScanningConfiguration: { scanOnPush: fd.get("scanOnPush") === "on" },
        encryptionConfiguration: { encryptionType: fd.get("kms") === "on" ? "KMS" : "AES256" },
      }),
    ),
  );
}

export async function deleteRepositories(fd: FormData) {
  const { ecr } = await aws();
  for (const n of fd.getAll("selected").map(String)) await guard(`Deleted repository ${n}.`, "/ecr/repositories", () => ecr.send(new DeleteRepositoryCommand({ repositoryName: n, force: true })));
  if (fd.get("from") === "detail") redirect("/ecr/repositories");
}

export async function deleteImages(fd: FormData) {
  const repo = String(fd.get("repo"));
  const { ecr } = await aws();
  await guard("Images deleted.", rp(repo), async () => {
    const r = await ecr.send(new BatchDeleteImageCommand({ repositoryName: repo, imageIds: fd.getAll("selected").map((d) => ({ imageDigest: String(d) })) }));
    if (r.failures?.length) throw new Error(r.failures.map((f) => `${f.failureCode}: ${f.failureReason}`).join("; "));
  });
}

export async function scanImage(fd: FormData) {
  const repo = String(fd.get("repo"));
  const { ecr } = await aws();
  await guard("Image scan started.", rp(repo), () => ecr.send(new StartImageScanCommand({ repositoryName: repo, imageId: { imageDigest: String(fd.get("digest")) } })));
}

export async function saveSettings(fd: FormData) {
  const repo = String(fd.get("repo"));
  const { ecr } = await aws();
  await guard("Repository settings saved.", rp(repo), async () => {
    await ecr.send(new PutImageTagMutabilityCommand({ repositoryName: repo, imageTagMutability: String(fd.get("mutability")) as ImageTagMutability }));
    await ecr.send(new PutImageScanningConfigurationCommand({ repositoryName: repo, imageScanningConfiguration: { scanOnPush: fd.get("scanOnPush") === "on" } }));
  });
}

export async function savePolicy(fd: FormData) {
  const repo = String(fd.get("repo"));
  const kind = String(fd.get("kind"));
  const text = String(fd.get("policy") ?? "").trim();
  const { ecr } = await aws();
  await guard(`${kind === "lifecycle" ? "Lifecycle" : "Repository"} policy ${text ? "saved" : "deleted"}.`, rp(repo), async () => {
    if (text) JSON.parse(text);
    if (kind === "lifecycle") {
      if (text) await ecr.send(new PutLifecyclePolicyCommand({ repositoryName: repo, lifecyclePolicyText: text }));
      else await ecr.send(new DeleteLifecyclePolicyCommand({ repositoryName: repo }));
    } else if (text) {
      await ecr.send(new SetRepositoryPolicyCommand({ repositoryName: repo, policyText: text }));
    } else {
      await ecr.send(new DeleteRepositoryPolicyCommand({ repositoryName: repo }));
    }
  });
}
