"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutBucketVersioningCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  CopyObjectCommand,
  DeleteBucketCorsCommand,
  DeleteBucketEncryptionCommand,
  DeleteBucketLifecycleCommand,
  DeleteBucketPolicyCommand,
  DeleteBucketTaggingCommand,
  DeleteBucketWebsiteCommand,
  DeleteObjectCommand,
  DeleteObjectTaggingCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
  PutBucketEncryptionCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketPolicyCommand,
  PutBucketTaggingCommand,
  PutBucketWebsiteCommand,
  PutObjectTaggingCommand,
  PutPublicAccessBlockCommand,
  type CORSRule,
  type LifecycleRule,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { aws, errorMessage, REGION } from "@/lib/emulator";
import { flash } from "@/lib/flash";

function selected(fd: FormData) {
  return fd.getAll("selected").map(String).filter(Boolean);
}

export async function createBucket(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { s3 } = await aws();
    await s3.send(
      new CreateBucketCommand({
        Bucket: name,
        ...(REGION !== "us-east-1" ? { CreateBucketConfiguration: { LocationConstraint: REGION as never } } : {}),
      }),
    );
    if (fd.get("versioning") === "on") {
      await s3.send(new PutBucketVersioningCommand({ Bucket: name, VersioningConfiguration: { Status: "Enabled" } }));
    }
  } catch (e) {
    await flash("error", `Failed to create bucket "${name}". ${errorMessage(e)}`);
    redirect("/s3/buckets/create");
  }
  await flash("success", `Successfully created bucket "${name}".`);
  redirect("/s3/buckets");
}

async function emptyOne(bucket: string) {
  const { s3 } = await aws();
  let token: string | undefined;
  let n = 0;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
      n += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return n;
}

export async function emptyBuckets(fd: FormData) {
  for (const b of selected(fd)) {
    try {
      const n = await emptyOne(b);
      await flash("success", `Successfully emptied bucket "${b}" (${n} objects deleted).`);
    } catch (e) {
      await flash("error", `Failed to empty bucket "${b}". ${errorMessage(e)}`);
    }
  }
  revalidatePath("/s3/buckets");
}

export async function deleteBuckets(fd: FormData) {
  const { s3 } = await aws();
  for (const b of selected(fd)) {
    try {
      await s3.send(new DeleteBucketCommand({ Bucket: b }));
      await flash("success", `Successfully deleted bucket "${b}".`);
    } catch (e) {
      await flash("error", `Failed to delete bucket "${b}". ${errorMessage(e)} Empty the bucket first if it still has objects.`);
    }
  }
  revalidatePath("/s3/buckets");
}

export async function deleteObjects(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const items = selected(fd);
  try {
    const { s3 } = await aws();
    const keys: string[] = [];
    for (const k of items) {
      if (k.endsWith("/")) {
        // A "folder": delete everything under the prefix.
        let token: string | undefined;
        do {
          const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: k, ContinuationToken: token }));
          keys.push(...(page.Contents ?? []).map((o) => o.Key!));
          token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
        keys.push(k);
      } else keys.push(k);
    }
    for (let i = 0; i < keys.length; i += 1000) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
    }
    await flash("success", `Successfully deleted ${items.length} item${items.length === 1 ? "" : "s"}.`);
  } catch (e) {
    await flash("error", `Failed to delete objects. ${errorMessage(e)}`);
  }
  revalidatePath(`/s3/buckets/${encodeURIComponent(bucket)}`);
}

export async function createFolder(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const prefix = String(fd.get("prefix") ?? "");
  const name = String(fd.get("name") ?? "").trim().replace(/\/+$/, "");
  try {
    if (!name) throw new Error("Folder name is required.");
    const { s3 } = await aws();
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `${prefix}${name}/`, Body: "" }));
    await flash("success", `Successfully created folder "${name}".`);
  } catch (e) {
    await flash("error", `Failed to create folder. ${errorMessage(e)}`);
  }
  revalidatePath(`/s3/buckets/${encodeURIComponent(bucket)}`);
}

export async function setVersioning(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const status = String(fd.get("status")) === "Enabled" ? "Enabled" : "Suspended";
  try {
    const { s3 } = await aws();
    await s3.send(new PutBucketVersioningCommand({ Bucket: bucket, VersioningConfiguration: { Status: status } }));
    await flash("success", `Bucket versioning ${status === "Enabled" ? "enabled" : "suspended"}.`);
  } catch (e) {
    await flash("error", `Failed to update versioning. ${errorMessage(e)}`);
  }
  revalidatePath(`/s3/buckets/${encodeURIComponent(bucket)}`);
}

// ---------- Bucket configuration (properties, permissions, management)

const bp = (b: string) => `/s3/buckets/${encodeURIComponent(b)}`;

async function run(ok: string, bucket: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(bp(bucket));
  revalidatePath(`${bp(bucket)}/object`);
}

/** JSON editors: empty text deletes the configuration. */
export async function saveBucketJson(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const kind = String(fd.get("kind"));
  const text = String(fd.get("json") ?? "").trim();
  const { s3 } = await aws();
  await run(`${kind[0].toUpperCase()}${kind.slice(1)} ${text ? "saved" : "deleted"}.`, bucket, async () => {
    const v = text ? JSON.parse(text) : null;
    switch (kind) {
      case "policy":
        return v ? s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(v) })) : s3.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
      case "cors":
        return v ? s3.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: (Array.isArray(v) ? v : v.CORSRules) as CORSRule[] } })) : s3.send(new DeleteBucketCorsCommand({ Bucket: bucket }));
      case "lifecycle":
        return v
          ? s3.send(new PutBucketLifecycleConfigurationCommand({ Bucket: bucket, LifecycleConfiguration: { Rules: (Array.isArray(v) ? v : v.Rules) as LifecycleRule[] } }))
          : s3.send(new DeleteBucketLifecycleCommand({ Bucket: bucket }));
    }
  });
}

export async function saveBucketTags(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const { s3 } = await aws();
  const tags = String(fd.get("tags") ?? "")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => ({ Key: l.slice(0, l.indexOf("=")).trim(), Value: l.slice(l.indexOf("=") + 1).trim() }));
  await run("Bucket tags saved.", bucket, () => (tags.length ? s3.send(new PutBucketTaggingCommand({ Bucket: bucket, Tagging: { TagSet: tags } })) : s3.send(new DeleteBucketTaggingCommand({ Bucket: bucket }))));
}

export async function saveEncryption(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const algo = String(fd.get("algo"));
  const key = String(fd.get("kmsKey") ?? "").trim();
  const { s3 } = await aws();
  await run("Default encryption saved.", bucket, () =>
    algo === "none"
      ? s3.send(new DeleteBucketEncryptionCommand({ Bucket: bucket }))
      : s3.send(
          new PutBucketEncryptionCommand({
            Bucket: bucket,
            ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: algo as "AES256" | "aws:kms", ...(algo === "aws:kms" && key ? { KMSMasterKeyID: key } : {}) }, BucketKeyEnabled: algo === "aws:kms" }] },
          }),
        ),
  );
}

export async function saveWebsite(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const { s3 } = await aws();
  await run(fd.get("enabled") === "on" ? "Static website hosting enabled." : "Static website hosting disabled.", bucket, () =>
    fd.get("enabled") === "on"
      ? s3.send(new PutBucketWebsiteCommand({ Bucket: bucket, WebsiteConfiguration: { IndexDocument: { Suffix: String(fd.get("index") || "index.html") }, ErrorDocument: String(fd.get("error") ?? "") ? { Key: String(fd.get("error")) } : undefined } }))
      : s3.send(new DeleteBucketWebsiteCommand({ Bucket: bucket })),
  );
}

export async function savePublicAccessBlock(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const { s3 } = await aws();
  const on = (k: string) => fd.get(k) === "on";
  await run("Block Public Access settings saved.", bucket, () =>
    s3.send(new PutPublicAccessBlockCommand({ Bucket: bucket, PublicAccessBlockConfiguration: { BlockPublicAcls: on("blockAcls"), IgnorePublicAcls: on("ignoreAcls"), BlockPublicPolicy: on("blockPolicy"), RestrictPublicBuckets: on("restrict") } })),
  );
}

export async function deleteVersions(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const { s3 } = await aws();
  const items = fd.getAll("selected").map(String);
  await run(`Deleted ${items.length} version${items.length === 1 ? "" : "s"}.`, bucket, async () => {
    for (const v of items) {
      const [key, versionId] = JSON.parse(v) as [string, string];
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: versionId }));
    }
  });
}

export async function copyObject(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const key = String(fd.get("key"));
  const destBucket = String(fd.get("destBucket") || bucket);
  const destKey = String(fd.get("destKey") ?? "").trim();
  const move = fd.get("move") === "on";
  let ok = false;
  try {
    const { s3 } = await aws();
    if (!destKey) throw new Error("Destination key is required.");
    await s3.send(new CopyObjectCommand({ Bucket: destBucket, Key: destKey, CopySource: `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}` }));
    if (move) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    await flash("success", `${move ? "Moved" : "Copied"} to s3://${destBucket}/${destKey}.`);
    ok = true;
  } catch (e) {
    await flash("error", `Copy failed. ${errorMessage(e)}`);
  }
  revalidatePath(bp(bucket));
  if (ok && move) redirect(`${bp(destBucket)}/object?key=${encodeURIComponent(destKey)}`);
  revalidatePath(`${bp(bucket)}/object`);
}

export async function saveObjectTags(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const key = String(fd.get("key"));
  const { s3 } = await aws();
  const tags = String(fd.get("tags") ?? "")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => ({ Key: l.slice(0, l.indexOf("=")).trim(), Value: l.slice(l.indexOf("=") + 1).trim() }));
  await run("Object tags saved.", bucket, () =>
    tags.length ? s3.send(new PutObjectTaggingCommand({ Bucket: bucket, Key: key, Tagging: { TagSet: tags } })) : s3.send(new DeleteObjectTaggingCommand({ Bucket: bucket, Key: key })),
  );
}

export type PresignResult = { url?: string; expires?: string; error?: string } | null;

/** Presigned GET URL against the emulator endpoint (valid for this emulator run only). */
export async function presign(_p: PresignResult, fd: FormData): Promise<PresignResult> {
  try {
    const { s3 } = await aws();
    const minutes = Math.max(1, Math.min(10080, Number(fd.get("minutes") || 60)));
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: String(fd.get("bucket")), Key: String(fd.get("key")) }), { expiresIn: minutes * 60 });
    return { url, expires: new Date(Date.now() + minutes * 60_000).toISOString() };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
