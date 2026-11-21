"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CreateTableCommand, DeleteItemCommand, DeleteTableCommand, PutItemCommand, type KeySchemaElement, type AttributeDefinition, type ScalarAttributeType } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
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
    const { dynamodb } = await aws();
    await dynamodb.send(new CreateTableCommand({ TableName: name, KeySchema: keys, AttributeDefinitions: attrs, BillingMode: "PAY_PER_REQUEST" }));
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
