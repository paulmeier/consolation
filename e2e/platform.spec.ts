import { expect, test } from "@playwright/test";
import { confirmDialog, expectFlash, go, uid } from "./helpers";

test("VPC: VPC, subnet, route to internet gateway, cleanup", async ({ page }) => {
  const name = uid("e2e-vpc");
  await go(page, "/vpc/vpcs");
  await page.getByRole("button", { name: "Create VPC" }).click();
  await page.locator("dialog[open] input[name=name]").fill(name);
  await page.locator("dialog[open] input[name=withIgw]").check();
  await page.locator("dialog[open] button", { hasText: "Create VPC" }).click();
  await expect(page).toHaveURL(/\/vpc\/vpcs\/vpc-/);
  const vpcId = page.url().split("/").pop()!.split("?")[0];
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create subnet" }).click();
  await page.locator("dialog[open] input[name=cidr]").fill("10.0.1.0/24");
  await page.locator("dialog[open] button", { hasText: "Create subnet" }).click();
  await expectFlash(page, "Subnet created");
  await go(page, `/vpc/vpcs/${vpcId}`);
  await page.locator('section:has(h2:has-text("Resource map")) a[href^="/vpc/route-tables/rtb-"]').click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Add route" }).click();
  await page.locator("dialog[open] button", { hasText: "Save changes" }).click();
  await expect(page.locator("td", { hasText: "0.0.0.0/0" })).toBeVisible();
  await go(page, "/vpc/subnets");
  await page.locator("tr", { hasText: vpcId }).locator("input[data-select]").first().check();
  await page.getByRole("button", { name: "Delete subnet" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Deleted subnet-");
  await go(page, "/vpc/vpcs");
  await page.locator("tr", { hasText: vpcId }).locator("input[data-select]").check();
  await page.getByRole("button", { name: "Delete VPC" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, `Deleted ${vpcId}`);
});

test("CloudFormation: create stack from sample, outputs, delete", async ({ page }) => {
  const stack = uid("e2e-stack");
  await go(page, "/cloudformation/stacks/create");
  await page.locator("input[name=name]").fill(stack);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page).toHaveURL(new RegExp(`stacks/${stack}`));
  await expect(async () => {
    await page.reload();
    await expect(page.locator("dd").nth(1)).toContainText("CREATE COMPLETE");
  }).toPass({ timeout: 30_000 });
  await go(page, `/cloudformation/stacks/${stack}?tab=outputs`);
  await expect(page.getByRole("cell", { name: "QueueUrl", exact: true })).toBeVisible();
  await go(page, `/cloudformation/stacks/${stack}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "deletion initiated");
});

test("API Gateway: REST mock method is callable through the invoke URL", async ({ page }) => {
  await go(page, "/apigateway/apis");
  await page.getByRole("button", { name: "Create API" }).click();
  await page.locator("dialog[open] select[name=type]").selectOption("REST");
  await page.locator("dialog[open] input[name=name]").fill(uid("e2e-rest"));
  await page.locator("dialog[open] button", { hasText: "Create API" }).click();
  await expect(page).toHaveURL(/\/apigateway\/rest\//);
  const api = page.url().split("/").pop()!.split("?")[0];
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create method" }).click();
  await page.locator("dialog[open] select[name=method]").selectOption("GET");
  await page.locator("dialog[open] button", { hasText: "Create method" }).click();
  await expectFlash(page, "GET method created");
  await page.getByRole("button", { name: "Deploy API" }).click();
  await page.locator("dialog[open] button", { hasText: /^Deploy$/ }).click();
  await expectFlash(page, "Deployed to stage dev");
  await go(page, `/apigateway/rest/${api}?tab=stages`);
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Hello from a mock integration")).toBeVisible();
  await page.getByRole("button", { name: "Delete API" }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "Deleted API");
});

test("Cognito: user pool with a user and a group", async ({ page }) => {
  await go(page, "/cognito/user-pools");
  await page.getByRole("button", { name: "Create user pool" }).click();
  await page.locator("dialog[open] input[name=name]").fill(uid("e2e-pool"));
  await page.locator("dialog[open] button", { hasText: "Create user pool" }).click();
  await expect(page).toHaveURL(/user-pools\/us-east-1_/);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Create user" }).click();
  await page.locator("dialog[open] input[name=email]").fill("tester@example.test");
  await page.locator("dialog[open] button", { hasText: "Create user" }).click();
  await expect(page.locator("td", { hasText: "tester@example.test" })).toBeVisible();
  await page.getByRole("button", { name: "Delete user pool" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "deleted");
});

test("ECS: task definition, cluster, service with running tasks", async ({ page }) => {
  const family = uid("e2e-td");
  const cluster = uid("e2e-cluster");
  await go(page, "/ecs/task-definitions/create");
  await page.locator("input[name=family]").fill(family);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expectFlash(page, `Task definition ${family}:1 registered`);
  await go(page, "/ecs/clusters");
  await page.getByRole("button", { name: "Create cluster" }).click();
  await page.locator("dialog[open] input[name=name]").fill(cluster);
  await page.locator("dialog[open] button", { hasText: /^Create$/ }).click();
  await expectFlash(page, "created successfully");
  await go(page, `/ecs/clusters/${cluster}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.locator("dialog[open] select[name=taskDefinition]").selectOption({ label: `${family}:1` });
  await page.locator("dialog[open] input[name=name]").fill("web");
  await page.locator("dialog[open] button", { hasText: /^Create$/ }).click();
  await expectFlash(page, "Service created");
  await expect(async () => {
    await page.reload();
    await expect(page.locator("tr", { hasText: "web" })).toContainText("1/1 running");
  }).toPass({ timeout: 20_000 });
  await page.locator("tr", { hasText: "web" }).locator("input[data-select]").check();
  await page.getByRole("button", { name: "Delete service" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "deleted");

  // Clean up: stop remaining tasks, delete the cluster, deregister the task definition.
  await go(page, `/ecs/clusters/${cluster}?tab=tasks`);
  const running = page.locator("tr[data-row]", { hasText: "RUNNING" }).locator("input[data-select]");
  if (await running.count()) {
    await running.evaluateAll((els) => els.forEach((e) => ((e as HTMLInputElement).checked = true)));
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await confirmDialog(page, "stop");
  }
  await expect(async () => {
    await go(page, `/ecs/clusters/${cluster}`);
    await page.getByRole("button", { name: "Delete cluster" }).click();
    await confirmDialog(page, "delete");
    await expect(page).toHaveURL(/\/ecs\/clusters$/);
  }).toPass({ timeout: 30_000 });
  await go(page, `/ecs/task-definitions/${family}`);
  await page.locator("tr[data-row] input[data-select]").first().check();
  await page.getByRole("button", { name: "Deregister" }).click();
  await confirmDialog(page, "deregister");
  await expectFlash(page, "Deregistered");
});

test("RDS: PostgreSQL instance with a managed master secret", async ({ page }) => {
  const id = uid("e2e-db");
  await go(page, "/rds/databases/create");
  await page.locator("input[name=id]").fill(id);
  await page.getByRole("button", { name: "Create database" }).click();
  await expectFlash(page, `Creating database ${id}`);
  await expect(async () => {
    await page.reload();
    await expect(page.locator("dd").first()).toContainText("Available");
  }).toPass({ timeout: 30_000 });
  await expect(page.locator('dl a[href^="/secretsmanager/"]')).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete me");
  await expectFlash(page, `Delete requested for ${id}`);
});

test("DynamoDB: query by partition key and edit an item", async ({ page }) => {
  const table = uid("e2e-q");
  await go(page, "/dynamodb/tables/create");
  await page.locator("input[name=name]").fill(table);
  await page.locator("input[name=pk]").fill("pk");
  await page.locator("input[name=sk]").fill("sk");
  await page.getByRole("button", { name: "Create table" }).click();
  await expectFlash(page, "created successfully");
  for (const [pk, sk] of [["a", "1"], ["a", "2"], ["b", "1"]]) {
    await go(page, `/dynamodb/tables/${table}?tab=items`);
    await page.getByRole("button", { name: "Create item" }).click();
    await page.locator("dialog[open] textarea[name=item]").fill(JSON.stringify({ pk, sk, n: 1 }));
    await page.locator("dialog[open] button", { hasText: "Create item" }).click();
    await expectFlash(page, "saved successfully");
  }
  await go(page, `/dynamodb/tables/${table}?tab=items&mode=query&pk=a`);
  await expect(page.locator("#ddb-items tr[data-row]")).toHaveCount(2);
  await page.locator("#ddb-items tr[data-row]").first().getByRole("button", { name: "Edit" }).click();
  const current = await page.locator("dialog[open] textarea[name=item]").inputValue();
  await page.locator("dialog[open] textarea[name=item]").fill(current.replace('"n": 1', '"n": 42'));
  await page.locator("dialog[open] button", { hasText: /^Save$/ }).click();
  await expect(page.locator("td", { hasText: "42" })).toBeVisible();
  await go(page, "/dynamodb/tables");
  await page.locator(`input[value="${table}"]`).check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "deleted successfully");
});
