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

export async function uploadObjects(fd: FormData) {
  const bucket = String(fd.get("bucket"));
  const prefix = String(fd.get("prefix") ?? "");
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size >= 0 && f.name !== "");
  try {
    if (!files.length) throw new Error("Choose at least one file.");
    const { s3 } = await aws();
    for (const f of files) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: prefix + f.name,
          Body: Buffer.from(await f.arrayBuffer()),
          ContentType: f.type || "application/octet-stream",
        }),
      );
    }
    await flash("success", `Upload succeeded: ${files.length} file${files.length === 1 ? "" : "s"}.`);
  } catch (e) {
    await flash("error", `Upload failed. ${errorMessage(e)}`);
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
