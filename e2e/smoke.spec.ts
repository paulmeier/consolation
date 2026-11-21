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
