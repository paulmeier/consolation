import { expect, test } from "@playwright/test";
import { confirmDialog, expectFlash, go, selectRow, uid } from "./helpers";

test("S3: bucket, folder, upload, preview, empty and delete", async ({ page }) => {
  const bucket = uid("e2e-bucket");
  await go(page, "/s3/buckets/create");
  await page.locator("input[name=name]").fill(bucket);
  await page.getByRole("button", { name: "Create bucket" }).click();
  await expectFlash(page, `Successfully created bucket "${bucket}"`);

  await page.getByRole("link", { name: bucket }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create folder" }).click();
  await page.locator("dialog[open] input[name=name]").fill("docs");
  await page.locator("dialog[open] button", { hasText: "Create folder" }).click();
  await page.getByRole("link", { name: "docs/" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Upload" }).click();
  await page.locator("dialog[open] input[type=file]").setInputFiles({ name: "hello.txt", mimeType: "text/plain", buffer: Buffer.from("hello from e2e\n") });
  await page.locator("dialog[open] button.bg-primary", { hasText: "Upload" }).click();
  await page.getByRole("link", { name: "hello.txt" }).click();
  await expect(page.locator("pre")).toContainText("hello from e2e");

  await go(page, "/s3/buckets");
  await selectRow(page, bucket);
  await page.getByRole("button", { name: "Empty", exact: true }).click();
  await confirmDialog(page, "permanently delete");
  await expectFlash(page, "Successfully emptied");
  await selectRow(page, bucket);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, `Successfully deleted bucket "${bucket}"`);
});

test("DynamoDB: table, item, delete", async ({ page }) => {
  const table = uid("e2e-table");
  await go(page, "/dynamodb/tables/create");
  await page.locator("input[name=name]").fill(table);
  await page.locator("input[name=pk]").fill("id");
  await page.getByRole("button", { name: "Create table" }).click();
  await expectFlash(page, "created successfully");
  await go(page, `/dynamodb/tables/${table}?tab=items`);
  await page.getByRole("button", { name: "Create item" }).click();
  await page.locator("dialog[open] textarea[name=item]").fill(JSON.stringify({ id: "a1", name: "Widget" }));
  await page.locator("dialog[open] button", { hasText: "Create item" }).click();
  await expect(page.locator("td", { hasText: "Widget" })).toBeVisible();
  await go(page, "/dynamodb/tables");
  await selectRow(page, table);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "deleted successfully");
});
