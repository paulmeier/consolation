import { expect, test } from "@playwright/test";
import { confirmDialog, expectFlash, go, selectRow, uid } from "./helpers";

test("SQS: send, poll and delete a queue", async ({ page }) => {
  const queue = uid("e2e-queue");
  await go(page, "/sqs/queues");
  await page.getByRole("button", { name: "Create queue" }).click();
  await page.locator("dialog[open] input[name=name]").fill(queue);
  await page.locator("dialog[open] button", { hasText: "Create queue" }).click();
  await expectFlash(page, `Queue ${queue} created`);
  await go(page, `/sqs/queues/${queue}?tab=messages`);
  await page.locator("textarea[name=body]").fill("ping");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Your message has been sent")).toBeVisible();
  await page.getByRole("button", { name: "Poll for messages" }).click();
  await expect(page.locator("td pre", { hasText: "ping" })).toBeVisible();
  await go(page, "/sqs/queues");
  await selectRow(page, queue);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, `Queue ${queue} deleted`);
});

test("Step Functions: create, execute and delete", async ({ page }) => {
  const name = uid("e2e-sm");
  await go(page, "/stepfunctions/state-machines/create");
  await page.locator("input[name=name]").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expectFlash(page, `Successfully created state machine ${name}`);
  await page.getByRole("button", { name: "Start execution" }).click();
  await page.locator("dialog[open] textarea[name=input]").fill('{"who":"e2e"}');
  await page.locator("dialog[open] button", { hasText: "Start execution" }).click();
  await expect(page).toHaveURL(/executions/);
  await expect(async () => {
    await page.reload();
    await expect(page.locator("dd").first()).toContainText("Succeeded");
  }).toPass({ timeout: 20_000 });
  await go(page, "/stepfunctions/state-machines");
  await selectRow(page, name);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "deleted");
});

test("Kinesis: put and read a record", async ({ page }) => {
  const stream = uid("e2e-stream");
  await go(page, "/kinesis/streams");
  await page.getByRole("button", { name: "Create data stream" }).click();
  await page.locator("dialog[open] input[name=name]").fill(stream);
  await page.locator("dialog[open] button", { hasText: "Create data stream" }).click();
  await expectFlash(page, stream);
  await go(page, `/kinesis/streams/${stream}`);
  await page.locator("textarea[name=data]").fill("record-from-e2e");
  await page.getByRole("button", { name: "Put record" }).click();
  const putMessage = page.getByText(/Record put to shardId-\d+/);
  await expect(putMessage).toBeVisible();
  const shard = (await putMessage.innerText()).match(/shardId-\d+/)![0];
  // Read the shard the record was routed to (reload until the new stream lists it).
  await expect(async () => {
    await page.reload();
    await page.locator("select[name=shard]").selectOption(shard);
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Get records" }).click();
  await expect(page.locator("td pre", { hasText: "record-from-e2e" })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "being deleted");
});
