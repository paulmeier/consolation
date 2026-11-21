import { expect, test } from "@playwright/test";
import { confirmDialog, go, uid } from "./helpers";

test("tables paginate, sort, filter and keep preferences", async ({ page }) => {
  const prefix = uid("tbl");
  // 25 queues -> two pages at the default page size of 20.
  for (let i = 1; i <= 25; i++) {
    await go(page, "/sqs/queues");
    await page.getByRole("button", { name: "Create queue" }).click();
    await page.locator("dialog[open] input[name=name]").fill(`${prefix}-${String(i).padStart(2, "0")}`);
    await page.locator("dialog[open] button", { hasText: "Create queue" }).click();
    await expect(page.getByRole("status")).toContainText("created");
  }
  await go(page, "/sqs/queues");
  const search = page.getByPlaceholder("Search queues by prefix");
  await search.fill(prefix);
  const visible = page.locator('#queues-table tr[data-row]:not([data-hidden="true"])');
  await expect(visible).toHaveCount(20);
  await page.getByRole("button", { name: "Page 2" }).click();
  await expect(visible).toHaveCount(5);

  await page.getByRole("button", { name: "Page 1" }).click();
  const nameHeader = page.locator('#queues-table th[data-col="0"]');
  await nameHeader.click();
  await nameHeader.click();
  await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  await expect(visible.first()).toContainText(`${prefix}-25`);

  await page.getByRole("button", { name: "Preferences" }).click();
  await page.locator("dialog[open] label", { hasText: "50 resources" }).locator("input").check();
  await page.locator("dialog[open] label", { hasText: "Created" }).locator("input").uncheck();
  await page.locator("dialog[open] button", { hasText: "Confirm" }).click();
  await expect(visible).toHaveCount(25);
  await expect(page.locator('#queues-table th[data-col="2"]')).toBeHidden();

  // Clean up: select all filtered rows and delete.
  await page.locator('#queues-table tr[data-row]:not([data-hidden="true"]) input[data-select]').evaluateAll((els) => els.forEach((e) => ((e as HTMLInputElement).checked = true)));
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expect(page.locator('#queues-table tr[data-row]', { hasText: prefix })).toHaveCount(0);

  // Reset preferences for other tests.
  await page.evaluate(() => localStorage.removeItem("consolation.table.queues-table"));
});
