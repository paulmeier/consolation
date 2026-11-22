import { expect, test } from "@playwright/test";
import { go, trackConsoleErrors } from "./helpers";

test("emulator is reachable", async ({ page }) => {
  await go(page, "/settings");
  await expect(page.getByText(/Healthy/)).toBeVisible();
});

const ROUTES = [
  "/",
  "/services",
  "/s3/buckets",
  "/dynamodb/tables",
  "/lambda/functions",
  "/sqs/queues",
  "/sns/topics",
  "/iam/users",
  "/iam/roles",
  "/iam/policies",
  "/cloudwatch/log-groups",
  "/cloudwatch/metrics",
  "/cloudwatch/alarms",
  "/cloudwatch/dashboards",
  "/ec2/instances",
  "/ec2/security-groups",
  "/ec2/key-pairs",
  "/secretsmanager/secrets",
  "/ssm/parameters",
  "/kms/keys",
  "/stepfunctions/state-machines",
  "/stepfunctions/activities",
  "/eventbridge/rules",
  "/eventbridge/buses",
  "/eventbridge/archives",
  "/eventbridge/destinations",
  "/kinesis/streams",
  "/ecr/repositories",
  "/route53/hosted-zones",
  "/route53/health-checks",
  "/vpc/vpcs",
  "/vpc/subnets",
  "/vpc/route-tables",
  "/vpc/internet-gateways",
  "/vpc/nat-gateways",
  "/vpc/elastic-ips",
  "/vpc/endpoints",
  "/vpc/network-acls",
  "/vpc/peering",
  "/cloudformation/stacks",
  "/cloudformation/exports",
  "/apigateway/apis",
  "/apigateway/api-keys",
  "/cognito/user-pools",
  "/cognito/identity-pools",
  "/ecs/clusters",
  "/ecs/task-definitions",
  "/rds/databases",
  "/rds/snapshots",
  "/rds/groups",
  "/lambda/layers",
  "/iam/groups",
  "/iam/identity-providers",
  "/iam/account-settings",
  "/iam/sts",
  "/sns/subscriptions",
  "/sns/mobile/push",
  "/sns/mobile/text-messaging",
  "/cloudwatch/logs-insights",
  "/cloudwatch/live-tail",
  "/ec2/amis",
  "/ec2/volumes",
  "/ec2/snapshots",
  "/ec2/launch-templates",
  "/ec2/elastic-ips",
  "/ec2/network-interfaces",
  "/ec2/placement-groups",
  "/ec2/spot-requests",
  "/ec2/capacity-reservations",
  "/ec2/dedicated-hosts",
  "/s3/access-points",
  "/dynamodb/imports",
  "/dynamodb/exports",
];

for (const route of ROUTES) {
  test(`renders ${route} without errors`, async ({ page }) => {
    const errors = trackConsoleErrors(page);
    const res = await page.goto(route);
    await page.waitForSelector("html[data-hydrated]", { state: "attached" });
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Request failed")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("service search navigates with the keyboard", async ({ page }) => {
  await go(page, "/");
  await page.keyboard.press("Alt+s");
  await page.keyboard.type("queue");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sqs\/queues/);
});

test("visual mode switches and persists", async ({ page }) => {
  await go(page, "/settings");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "system");
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(html).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(18, 17, 16)");
  await go(page, "/s3/buckets");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Visual mode" }).click();
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("density switches to compact and persists", async ({ page }) => {
  await go(page, "/settings");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-density", "comfortable");
  const header = page.locator("[data-ctr=header]").first();
  const before = await header.evaluate((el) => getComputedStyle(el).paddingTop);
  await page.getByRole("radio", { name: "Compact", exact: true }).check();
  await expect(html).toHaveAttribute("data-density", "compact");
  await expect.poll(() => header.evaluate((el) => getComputedStyle(el).paddingTop)).not.toBe(before);
  await page.reload();
  await expect(html).toHaveAttribute("data-density", "compact");
});
