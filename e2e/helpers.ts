import { expect, type Page } from "@playwright/test";

/** Unique, lowercase name per test run so tests don't collide with existing resources. */
export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/** Navigate and wait until client components have hydrated. */
export async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await page.waitForLoadState("networkidle");
}

/** The flash notification shown after a Server Action. */
export async function expectFlash(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status")).toContainText(text);
}

/** Fill and submit an open ConfirmAction dialog. */
export async function confirmDialog(page: Page, word: string) {
  const dialog = page.locator("dialog[open]");
  await dialog.locator(`input[placeholder="${word}"]`).fill(word);
  await dialog.locator("button[type=submit]").click();
}

/** Select the table row containing `text`. */
export async function selectRow(page: Page, text: string) {
  await page.locator("tr", { hasText: text }).locator("input[data-select]").check();
}

/** Collect console errors for the lifetime of the page. */
export function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
