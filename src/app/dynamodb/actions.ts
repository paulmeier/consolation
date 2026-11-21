"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CreateTableCommand, DeleteItemCommand, DeleteTableCommand, PutItemCommand, type KeySchemaElement, type AttributeDefinition, type ScalarAttributeType } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  CreateBackupCommand,
  DeleteBackupCommand,
  ExecuteStatementCommand,
  RestoreTableFromBackupCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateContinuousBackupsCommand,
  UpdateTableCommand,
  UpdateTimeToLiveCommand,
  type StreamViewType,
} from "@aws-sdk/client-dynamodb";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

export async function createTable(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const pk = String(fd.get("pk") ?? "").trim();
  const pkType = String(fd.get("pkType") ?? "S") as ScalarAttributeType;
  const sk = String(fd.get("sk") ?? "").trim();
  const skType = String(fd.get("skType") ?? "S") as ScalarAttributeType;
  try {
    const keys: KeySchemaElement[] = [{ AttributeName: pk, KeyType: "HASH" }];
    const attrs: AttributeDefinition[] = [{ AttributeName: pk, AttributeType: pkType }];
    if (sk) {
      keys.push({ AttributeName: sk, KeyType: "RANGE" });
      attrs.push({ AttributeName: sk, AttributeType: skType });
    }
    const gsiName = String(fd.get("gsiName") ?? "").trim();
    const gsiPk = String(fd.get("gsiPk") ?? "").trim();
    if (gsiName && gsiPk && !attrs.some((a) => a.AttributeName === gsiPk)) attrs.push({ AttributeName: gsiPk, AttributeType: String(fd.get("gsiPkType") ?? "S") as ScalarAttributeType });
    const { dynamodb } = await aws();
    await dynamodb.send(
      new CreateTableCommand({
        TableName: name,
        KeySchema: keys,
        AttributeDefinitions: attrs,
        BillingMode: "PAY_PER_REQUEST",
        ...(gsiName && gsiPk ? { GlobalSecondaryIndexes: [{ IndexName: gsiName, KeySchema: [{ AttributeName: gsiPk, KeyType: "HASH" }], Projection: { ProjectionType: "ALL" } }] } : {}),
        DeletionProtectionEnabled: fd.get("protect") === "on",
      }),
    );
  } catch (e) {
    await flash("error", `Failed to create table "${name}". ${errorMessage(e)}`);
    redirect("/dynamodb/tables/create");
  }
  await flash("success", `The ${name} table was created successfully.`);
  redirect("/dynamodb/tables");
}

export async function deleteTables(fd: FormData) {
  const { dynamodb } = await aws();
  for (const t of fd.getAll("selected").map(String)) {
    try {
      await dynamodb.send(new DeleteTableCommand({ TableName: t }));
      await flash("success", `The ${t} table was deleted successfully.`);
    } catch (e) {
      await flash("error", `Failed to delete table "${t}". ${errorMessage(e)}`);
    }
  }
  revalidatePath("/dynamodb/tables");
}

export async function putItem(fd: FormData) {
  const table = String(fd.get("table"));
  try {
    const parsed = JSON.parse(String(fd.get("item") ?? "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The item must be a JSON object.");
    const { dynamodb } = await aws();
    await dynamodb.send(new PutItemCommand({ TableName: table, Item: marshall(parsed, { removeUndefinedValues: true }) }));
    await flash("success", "The item has been saved successfully.");
  } catch (e) {
    await flash("error", `Failed to save the item. ${errorMessage(e)}`);
  }
  revalidatePath(`/dynamodb/tables/${encodeURIComponent(table)}`);
}

export async function deleteItems(fd: FormData) {
  const table = String(fd.get("table"));
  const keys = fd.getAll("selected").map(String);
  try {
    const { dynamodb } = await aws();
    for (const k of keys) await dynamodb.send(new DeleteItemCommand({ TableName: table, Key: marshall(JSON.parse(k)) }));
    await flash("success", `${keys.length} item${keys.length === 1 ? "" : "s"} deleted.`);
  } catch (e) {
    await flash("error", `Failed to delete items. ${errorMessage(e)}`);
  }
  revalidatePath(`/dynamodb/tables/${encodeURIComponent(table)}`);
}

// ---------- Indexes, settings, backups, streams, PartiQL

const tp = (t: string) => `/dynamodb/tables/${encodeURIComponent(t)}`;

async function run(ok: string, table: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(tp(table));
}

export async function createGsi(fd: FormData) {
  const table = String(fd.get("table"));
  const pk = String(fd.get("pk")).trim();
  const sk = String(fd.get("sk") ?? "").trim();
  const { dynamodb } = await aws();
  await run(`Index ${fd.get("name")} is being created.`, table, () =>
    dynamodb.send(
      new UpdateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: pk, AttributeType: String(fd.get("pkType") ?? "S") as "S" | "N" | "B" }, ...(sk ? [{ AttributeName: sk, AttributeType: String(fd.get("skType") ?? "S") as "S" | "N" | "B" }] : [])],
        GlobalSecondaryIndexUpdates: [
          {
            Create: {
              IndexName: String(fd.get("name")),
              KeySchema: [{ AttributeName: pk, KeyType: "HASH" }, ...(sk ? [{ AttributeName: sk, KeyType: "RANGE" as const }] : [])],
              Projection: { ProjectionType: "ALL" },
            },
          },
        ],
      }),
    ),
  );
}

export async function deleteGsis(fd: FormData) {
  const table = String(fd.get("table"));
  const { dynamodb } = await aws();
  for (const n of fd.getAll("selected").map(String)) await run(`Index ${n} is being deleted.`, table, () => dynamodb.send(new UpdateTableCommand({ TableName: table, GlobalSecondaryIndexUpdates: [{ Delete: { IndexName: n } }] })));
}

export async function setTtl(fd: FormData) {
  const table = String(fd.get("table"));
  const enable = fd.get("enable") === "true";
  const { dynamodb } = await aws();
  await run(enable ? "Time to Live turned on." : "Time to Live turned off.", table, () =>
    dynamodb.send(new UpdateTimeToLiveCommand({ TableName: table, TimeToLiveSpecification: { Enabled: enable, AttributeName: String(fd.get("attribute") || "ttl") } })),
  );
}

export async function setPitr(fd: FormData) {
  const table = String(fd.get("table"));
  const enable = fd.get("enable") === "true";
  const { dynamodb } = await aws();
  await run(enable ? "Point-in-time recovery turned on." : "Point-in-time recovery turned off.", table, () =>
    dynamodb.send(new UpdateContinuousBackupsCommand({ TableName: table, PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: enable } })),
  );
}

export async function setDeletionProtection(fd: FormData) {
  const table = String(fd.get("table"));
  const enable = fd.get("enable") === "true";
  const { dynamodb } = await aws();
  await run(enable ? "Deletion protection turned on." : "Deletion protection turned off.", table, () => dynamodb.send(new UpdateTableCommand({ TableName: table, DeletionProtectionEnabled: enable })));
}

export async function setStream(fd: FormData) {
  const table = String(fd.get("table"));
  const view = String(fd.get("view") ?? "");
  const { dynamodb } = await aws();
  await run(view ? "DynamoDB stream turned on." : "DynamoDB stream turned off.", table, () =>
    dynamodb.send(new UpdateTableCommand({ TableName: table, StreamSpecification: view ? { StreamEnabled: true, StreamViewType: view as StreamViewType } : { StreamEnabled: false } })),
  );
}

export async function tagTable(fd: FormData) {
  const table = String(fd.get("table"));
  const { dynamodb } = await aws();
  await run("Tag added.", table, () => dynamodb.send(new TagResourceCommand({ ResourceArn: String(fd.get("arn")), Tags: [{ Key: String(fd.get("key")), Value: String(fd.get("value") ?? "") }] })));
}

export async function untagTable(fd: FormData) {
  const table = String(fd.get("table"));
  const { dynamodb } = await aws();
  await run("Tags removed.", table, () => dynamodb.send(new UntagResourceCommand({ ResourceArn: String(fd.get("arn")), TagKeys: fd.getAll("selected").map(String) })));
}

export async function createBackup(fd: FormData) {
  const table = String(fd.get("table"));
  const { dynamodb } = await aws();
  await run("Backup created.", table, () => dynamodb.send(new CreateBackupCommand({ TableName: table, BackupName: String(fd.get("name") || `${table}-${Date.now()}`) })));
}

export async function deleteBackups(fd: FormData) {
  const table = String(fd.get("table"));
  const { dynamodb } = await aws();
  for (const arn of fd.getAll("selected").map(String)) await run("Backup deleted.", table, () => dynamodb.send(new DeleteBackupCommand({ BackupArn: arn })));
}

export async function restoreBackup(fd: FormData) {
  const table = String(fd.get("table"));
  const target = String(fd.get("target") ?? "").trim();
  const { dynamodb } = await aws();
  for (const arn of fd.getAll("selected").map(String)) await run(`Restoring to table ${target}.`, table, () => dynamodb.send(new RestoreTableFromBackupCommand({ BackupArn: arn, TargetTableName: target })));
  revalidatePath("/dynamodb/tables");
}

export type PartiqlResult = { items?: Record<string, unknown>[]; next?: string; error?: string; ms?: number } | null;

export async function runPartiql(_p: PartiqlResult, fd: FormData): Promise<PartiqlResult> {
  const started = Date.now();
  try {
    const { dynamodb } = await aws();
    const r = await dynamodb.send(new ExecuteStatementCommand({ Statement: String(fd.get("statement") ?? ""), Limit: 100 }));
    return { items: (r.Items ?? []).map((i) => unmarshall(i)), next: r.NextToken, ms: Date.now() - started };
  } catch (e) {
    return { error: errorMessage(e), ms: Date.now() - started };
  }
}
