import { expect, test } from "@playwright/test";
import { confirmDialog, expectFlash, go, uid } from "./helpers";

test("Secrets Manager: store, reveal, schedule deletion and restore", async ({ page }) => {
  const name = `e2e/${uid("secret")}`;
  await go(page, "/secretsmanager/secrets/create");
  await page.getByRole("textbox", { name: "Key", exact: true }).fill("password");
  await page.getByRole("textbox", { name: "Value", exact: true }).fill("s3cr3t");
  await page.locator("input[name=name]").fill(name);
  await page.getByRole("button", { name: "Store", exact: true }).click();
  await expectFlash(page, `You successfully stored the secret ${name}`);
  await page.getByRole("button", { name: "Retrieve secret value" }).click();
  await expect(page.locator("td", { hasText: "s3cr3t" })).toBeVisible();

  await go(page, "/secretsmanager/secrets");
  await page.locator("tr", { hasText: name }).locator("input[data-select]").check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.locator("dialog[open] input[name=window]").fill("7");
  await confirmDialog(page, "delete");
  await expectFlash(page, "scheduled for deletion in 7 days");
  await page.getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expectFlash(page, "was cancelled");

  // Clean up without a recovery window.
  await go(page, "/secretsmanager/secrets");
  await page.locator("tr", { hasText: name }).locator("input[data-select]").check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.locator("dialog[open] input[name=force]").check();
  await confirmDialog(page, "delete");
  await expectFlash(page, `Secret ${name} deleted`);
});

test("Parameter Store: SecureString is masked until decrypted", async ({ page }) => {
  const name = `/e2e/${uid("param")}/password`;
  await go(page, "/ssm/parameters/create");
  await page.locator("input[name=name]").fill(name);
  await page.locator("select[name=type]").selectOption("SecureString");
  await page.locator("textarea[name=value]").fill("hunter2");
  await page.getByRole("button", { name: "Create parameter" }).click();
  await expectFlash(page, "Create parameter request succeeded");
  await expect(page.locator("body")).not.toContainText("hunter2");
  await page.getByRole("button", { name: "Show decrypted value" }).click();
  await expect(page.locator("pre", { hasText: "hunter2" })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Deleted 1 parameter");
});

test("KMS: encrypt/decrypt round trip", async ({ page }) => {
  await go(page, "/kms/keys/create");
  await page.locator("input[name=alias]").fill(uid("e2e-key"));
  await page.getByRole("button", { name: "Create key" }).click();
  await expectFlash(page, "Your AWS KMS key was created");
  await go(page, `${new URL(page.url()).pathname}?tab=test`);
  await page.locator("textarea[name=input]").fill("hello kms");
  await page.locator("main form button.bg-primary", { hasText: "Encrypt" }).click();
  const ciphertext = (await page.locator("main pre").innerText()).trim();
  await page.locator("main button", { hasText: /^Decrypt$/ }).click();
  await page.locator("textarea[name=input]").fill(ciphertext);
  await page.locator("main form button.bg-primary", { hasText: "Decrypt" }).click();
  await expect(page.locator("main pre", { hasText: "hello kms" })).toBeVisible();
  await page.getByRole("button", { name: "Schedule key deletion" }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "scheduled for deletion");
});
