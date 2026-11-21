"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CreateStreamCommand,
  DecreaseStreamRetentionPeriodCommand,
  DeleteStreamCommand,
  DeregisterStreamConsumerCommand,
  GetRecordsCommand,
  GetShardIteratorCommand,
  IncreaseStreamRetentionPeriodCommand,
  ListShardsCommand,
  MergeShardsCommand,
  PutRecordCommand,
  RegisterStreamConsumerCommand,
  SplitShardCommand,
  UpdateShardCountCommand,
  type ShardIteratorType,
} from "@aws-sdk/client-kinesis";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const sp = (name: string) => `/kinesis/streams/${encodeURIComponent(name)}`;

async function guard(ok: string, path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(path);
}

export async function createStream(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { kinesis } = await aws();
    const onDemand = fd.get("mode") === "ON_DEMAND";
    await kinesis.send(new CreateStreamCommand({ StreamName: name, ...(onDemand ? { StreamModeDetails: { StreamMode: "ON_DEMAND" } } : { ShardCount: Number(fd.get("shards") || 1), StreamModeDetails: { StreamMode: "PROVISIONED" } }) }));
    await flash("success", `Data stream ${name} is being created.`);
  } catch (e) {
    await flash("error", `Failed to create data stream ${name}. ${errorMessage(e)}`);
  }
  revalidatePath("/kinesis/streams");
}

export async function deleteStreams(fd: FormData) {
  const { kinesis } = await aws();
  for (const n of fd.getAll("selected").map(String)) await guard(`Data stream ${n} is being deleted.`, "/kinesis/streams", () => kinesis.send(new DeleteStreamCommand({ StreamName: n, EnforceConsumerDeletion: true })));
  if (fd.get("from") === "detail") redirect("/kinesis/streams");
}

export async function setRetention(fd: FormData) {
  const name = String(fd.get("name"));
  const hours = Number(fd.get("hours"));
  const current = Number(fd.get("current"));
  const { kinesis } = await aws();
  await guard(`Retention period set to ${hours} hours.`, sp(name), () =>
    kinesis.send(hours > current ? new IncreaseStreamRetentionPeriodCommand({ StreamName: name, RetentionPeriodHours: hours }) : new DecreaseStreamRetentionPeriodCommand({ StreamName: name, RetentionPeriodHours: hours })),
  );
}

export async function scaleStream(fd: FormData) {
  const name = String(fd.get("name"));
  const { kinesis } = await aws();
  await guard("Shard count update started.", sp(name), () => kinesis.send(new UpdateShardCountCommand({ StreamName: name, TargetShardCount: Number(fd.get("count")), ScalingType: "UNIFORM_SCALING" })));
}

export async function splitShard(fd: FormData) {
  const name = String(fd.get("name"));
  const shard = String(fd.get("shard"));
  const { kinesis } = await aws();
  await guard(`Splitting ${shard}.`, sp(name), async () => {
    const shards = (await kinesis.send(new ListShardsCommand({ StreamName: name }))).Shards ?? [];
    const s = shards.find((x) => x.ShardId === shard);
    if (!s?.HashKeyRange) throw new Error("Shard not found.");
    const mid = (BigInt(s.HashKeyRange.StartingHashKey!) + BigInt(s.HashKeyRange.EndingHashKey!)) / BigInt(2);
    await kinesis.send(new SplitShardCommand({ StreamName: name, ShardToSplit: shard, NewStartingHashKey: mid.toString() }));
  });
}

export async function mergeShards(fd: FormData) {
  const name = String(fd.get("name"));
  const [a, b] = fd.getAll("selected").map(String);
  const { kinesis } = await aws();
  await guard(`Merging ${a} and ${b}.`, sp(name), async () => {
    if (!a || !b) throw new Error("Select two adjacent open shards to merge.");
    await kinesis.send(new MergeShardsCommand({ StreamName: name, ShardToMerge: a, AdjacentShardToMerge: b }));
  });
}

export async function registerConsumer(fd: FormData) {
  const name = String(fd.get("name"));
  const { kinesis } = await aws();
  await guard("Consumer registered.", sp(name), () => kinesis.send(new RegisterStreamConsumerCommand({ StreamARN: String(fd.get("arn")), ConsumerName: String(fd.get("consumer")) })));
}

export async function deregisterConsumers(fd: FormData) {
  const name = String(fd.get("name"));
  const { kinesis } = await aws();
  for (const c of fd.getAll("selected").map(String)) await guard("Consumer deregistered.", sp(name), () => kinesis.send(new DeregisterStreamConsumerCommand({ ConsumerARN: c })));
}

export type PutResult = { ok?: string; error?: string } | null;

export async function putRecord(_p: PutResult, fd: FormData): Promise<PutResult> {
  try {
    const { kinesis } = await aws();
    const r = await kinesis.send(new PutRecordCommand({ StreamName: String(fd.get("name")), PartitionKey: String(fd.get("key") || "pk"), Data: Buffer.from(String(fd.get("data") ?? ""), "utf8") }));
    return { ok: `Record put to ${r.ShardId}, sequence number ${r.SequenceNumber}.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export type ReadResult = { records?: { seq: string; key: string; at?: string; data: string }[]; shard?: string; error?: string; millisBehind?: number } | null;

export async function readRecords(_p: ReadResult, fd: FormData): Promise<ReadResult> {
  const name = String(fd.get("name"));
  const shard = String(fd.get("shard"));
  try {
    const { kinesis } = await aws();
    const type = String(fd.get("position") || "TRIM_HORIZON") as ShardIteratorType;
    const it = await kinesis.send(new GetShardIteratorCommand({ StreamName: name, ShardId: shard, ShardIteratorType: type, ...(type === "AT_TIMESTAMP" ? { Timestamp: new Date(Date.now() - 3600_000) } : {}) }));
    const r = await kinesis.send(new GetRecordsCommand({ ShardIterator: it.ShardIterator, Limit: 100 }));
    return {
      shard,
      millisBehind: r.MillisBehindLatest,
      records: (r.Records ?? []).map((x) => ({
        seq: x.SequenceNumber!,
        key: x.PartitionKey!,
        at: x.ApproximateArrivalTimestamp?.toISOString(),
        data: Buffer.from(x.Data ?? new Uint8Array()).toString("utf8"),
      })),
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
