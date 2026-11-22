import { expect, test, type Page } from "@playwright/test";
import { confirmDialog, expectFlash, go, selectRow, uid } from "./helpers";
import { deleteTestRepository, pushTestImage } from "./emulator-sdk";

/** Open a header modal by its button label and return the open dialog. */
async function openModal(page: Page, label: string, nth = 0) {
  await page.getByRole("button", { name: label, exact: true }).nth(nth).click();
  return page.locator("dialog[open]");
}

async function createQueue(page: Page, name: string) {
  await go(page, "/sqs/queues");
  await page.getByRole("button", { name: "Create queue" }).click();
  await page.locator("dialog[open] input[name=name]").fill(name);
  await page.locator("dialog[open] button", { hasText: "Create queue" }).click();
  await expectFlash(page, `Queue ${name} created`);
}

test("SQS: settings, dead-letter queue, policy, encryption, tags and attributes", async ({ page }) => {
  const src = uid("e2e-src");
  const dlq = uid("e2e-dlq");
  await createQueue(page, src);
  await createQueue(page, dlq);

  // Edit queue settings
  await go(page, `/sqs/queues/${src}`);
  let d = await openModal(page, "Edit");
  await d.locator("input[name=visibility]").fill("45");
  await d.locator("input[name=wait]").fill("5");
  await d.getByRole("button", { name: "Save" }).click();
  await expectFlash(page, `Queue ${src} updated`);
  await expect(page.getByText("45 Seconds")).toBeVisible();
  await expect(page.getByText("5 Seconds", { exact: true })).toBeVisible();

  // Dead-letter queue
  await go(page, `/sqs/queues/${src}?tab=dlq`);
  d = await openModal(page, "Edit", 1);
  await d.locator("select[name=dlqArn]").selectOption({ label: dlq });
  await d.locator("input[name=maxReceiveCount]").fill("3");
  await d.getByRole("button", { name: "Save" }).click();
  await expectFlash(page, `Dead-letter queue set for ${src}`);
  await expect(page.locator("dd", { hasText: dlq })).toBeVisible();
  await go(page, `/sqs/queues/${dlq}?tab=dlq`);
  await expect(page.locator("dd", { hasText: src })).toBeVisible();

  // Permission (access policy)
  await go(page, `/sqs/queues/${src}?tab=policy`);
  d = await openModal(page, "Add permission");
  await d.locator("input[name=label]").fill("e2eSend");
  await d.getByRole("button", { name: "Add permission" }).click();
  await expectFlash(page, "Permission e2eSend added");
  await expect(page.locator("td", { hasText: "e2eSend" })).toBeVisible();

  // Encryption
  await go(page, `/sqs/queues/${src}?tab=encryption`);
  d = await openModal(page, "Edit", 1);
  await d.locator("input[value=none]").check();
  await d.getByRole("button", { name: "Save" }).click();
  await expectFlash(page, "Encryption");
  await expect(page.locator("dd", { hasText: "Disabled" }).first()).toBeVisible();

  // Tags
  await go(page, `/sqs/queues/${src}?tab=tags`);
  d = await openModal(page, "Add tag");
  await d.locator("input[name=key]").fill("team");
  await d.locator("input[name=value]").fill("e2e");
  await d.getByRole("button", { name: "Add tag" }).click();
  await expectFlash(page, "Tag added");
  await expect(page.locator("td", { hasText: "team" })).toBeVisible();

  // Message attributes
  await go(page, `/sqs/queues/${src}?tab=messages`);
  await page.locator("textarea[name=body]").fill("with-attrs");
  await page.getByText("Message attributes").click();
  await page.getByLabel("Key", { exact: true }).first().fill("color");
  await page.getByLabel("Value", { exact: true }).first().fill("blue");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Your message has been sent")).toBeVisible();
  await page.getByRole("button", { name: "Poll for messages" }).click();
  await expect(page.locator("td pre", { hasText: "with-attrs" })).toBeVisible();
  await page.getByText("Details", { exact: true }).last().click();
  await expect(page.getByText("blue (String)")).toBeVisible();

  // Clean up
  await go(page, "/sqs/queues");
  await selectRow(page, src);
  await selectRow(page, dlq);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "deleted");
});

test("SNS: topic settings, SQS subscription with filter policy, push and SMS", async ({ page }) => {
  const topic = uid("e2e-topic");
  const queue = uid("e2e-subq");
  const arn = `arn:aws:sns:us-east-1:000000000000:${topic}`;
  await go(page, "/sns/topics");
  await page.getByRole("button", { name: "Create topic" }).click();
  await page.locator("dialog[open] input[name=name]").fill(topic);
  await page.locator("dialog[open] button", { hasText: "Create topic" }).click();
  await expectFlash(page, `Topic ${topic} created`);
  await createQueue(page, queue);

  // Subscribe the queue from the SQS side, with raw delivery
  await go(page, `/sqs/queues/${queue}?tab=subscriptions`);
  let d = await openModal(page, "Subscribe to Amazon SNS topic");
  await d.locator("select[name=topicArn]").selectOption(arn);
  await d.locator("input[name=raw]").check();
  await d.getByRole("button", { name: "Save" }).click();
  await expectFlash(page, `subscribed to ${topic}`);
  await expect(page.locator("td a", { hasText: topic })).toBeVisible();

  // Filter policy on the subscription
  await go(page, `/sns/topics/${encodeURIComponent(arn)}`);
  await page.locator("td a").first().click();
  await expect(page.getByRole("heading", { name: /Subscription:/ })).toBeVisible();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  d = await openModal(page, "Edit");
  await d.locator("textarea[name=filter]").fill('{"color":["blue"]}');
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, "Subscription updated");
  await expect(page.locator("pre", { hasText: '"blue"' })).toBeVisible();

  // Edit the topic and publish one matching and one non-matching message
  await go(page, `/sns/topics/${encodeURIComponent(arn)}`);
  d = await openModal(page, "Edit");
  await d.locator("input[name=display]").fill("E2E Display");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, `Topic ${topic} updated`);
  await expect(page.locator("dd", { hasText: "E2E Display" })).toBeVisible();
  for (const [body, color] of [["match-me", "blue"], ["skip-me", "red"]]) {
    d = await openModal(page, "Publish message");
    await d.locator("textarea[name=message]").fill(body);
    if ((await d.locator("details").getAttribute("open")) === null) await d.getByText("Message attributes").click();
    await d.getByLabel("Key", { exact: true }).first().fill("color");
    await d.getByLabel("Value", { exact: true }).first().fill(color);
    await d.getByRole("button", { name: "Publish message" }).click();
    await expectFlash(page, "Message published");
    await page.getByRole("button", { name: "Dismiss" }).click();
  }
  // The subscribe action added a queue policy statement for the topic, so SNS delivers;
  // the filter policy lets only the blue message through.
  await go(page, `/sqs/queues/${queue}?tab=messages`);
  await page.getByRole("button", { name: "Poll for messages" }).click();
  await expect(page.locator("td pre", { hasText: "match-me" })).toBeVisible();
  await expect(page.locator("td pre", { hasText: "skip-me" })).toHaveCount(0);

  // Encryption and tags
  await go(page, `/sns/topics/${encodeURIComponent(arn)}?tab=encryption`);
  d = await openModal(page, "Edit", 1);
  await d.locator("input[name=encryption][value=on]").check();
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, "Encryption enabled");
  await expect(page.locator("dd", { hasText: "alias/aws/sns" })).toBeVisible();
  await go(page, `/sns/topics/${encodeURIComponent(arn)}?tab=tags`);
  d = await openModal(page, "Add tag");
  await d.locator("input[name=key]").fill("env");
  await d.getByRole("button", { name: "Add tag" }).click();
  await expectFlash(page, "Tag added");
  await expect(page.locator("td", { hasText: "env" })).toBeVisible();

  // JSON policies and delivery status logging save with their defaults
  for (const [tabId, flash] of [["delivery", "Delivery policy saved"], ["policy", "Access policy saved"], ["logging", "Delivery status logging saved"]]) {
    await go(page, `/sns/topics/${encodeURIComponent(arn)}?tab=${tabId}`);
    d = await openModal(page, "Edit", 1);
    if (tabId === "logging") await d.locator("input[name=log-SQS]").check();
    await d.getByRole("button", { name: "Save changes" }).click();
    await expectFlash(page, flash);
  }
  await expect(page.locator("dd", { hasText: "SQS" })).toBeVisible();

  // Mobile push
  const app = uid("e2e-app");
  await go(page, "/sns/mobile/push");
  d = await openModal(page, "Create platform application");
  await d.locator("input[name=name]").fill(app);
  // The emulator validates FCM and APNs credentials; ADM accepts any client ID and secret.
  await d.locator("select[name=platform]").selectOption("ADM");
  await d.locator("textarea[name=credential]").fill("client-secret");
  await d.locator("input[name=principal]").fill("client-id");
  await d.getByRole("button", { name: "Create platform application" }).click();
  await expectFlash(page, `Platform application ${app} created`);
  await page.getByRole("link", { name: app }).click();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  d = await openModal(page, "Create application endpoint");
  await d.locator("textarea[name=token]").fill("device-token-123");
  await d.getByRole("button", { name: "Create application endpoint" }).click();
  await expectFlash(page, "Application endpoint created");
  await expect(page.locator("td", { hasText: "device-token-123" })).toBeVisible();
  await go(page, "/sns/mobile/push");
  await selectRow(page, app);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Platform application deleted");

  // SMS sandbox
  await go(page, "/sns/mobile/text-messaging");
  d = await openModal(page, "Add phone number");
  await d.locator("input[name=phone]").fill("+12065550100");
  await d.getByRole("button", { name: "Add phone number" }).click();
  await expectFlash(page, "Phone number added");
  await expect(page.locator("td", { hasText: "+12065550100" })).toBeVisible();
  await selectRow(page, "+12065550100");
  await page.getByRole("button", { name: "Delete phone number" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Phone number deleted");

  // Clean up
  await go(page, "/sns/topics");
  await selectRow(page, topic);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete me");
  await expectFlash(page, "deleted");
  await go(page, "/sqs/queues");
  await selectRow(page, queue);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "deleted");
});

test("IAM: groups, inline policies, boundaries, credentials, versions, providers, account and STS", async ({ page }) => {
  const group = uid("e2e-group");
  const user = uid("e2e-user");
  const role = uid("e2e-role");
  const policy = uid("e2e-policy");
  const inline = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:ListBucket","Resource":"*"}]}';

  // User
  await go(page, "/iam/users");
  let d = await openModal(page, "Create user");
  await d.locator("input[name=name]").fill(user);
  await d.locator("button[type=submit], button:not([type])").last().click();
  await expectFlash(page, `User ${user} created`);

  // Group with a member, managed policy and inline policy
  await go(page, "/iam/groups");
  d = await openModal(page, "Create group");
  await d.locator("input[name=name]").fill(group);
  await d.locator("input[name=policies]").fill("arn:aws:iam::aws:policy/ReadOnlyAccess");
  await d.getByRole("button", { name: "Create user group" }).click();
  await expectFlash(page, `User group ${group} created`);
  await expect(page.locator("tr", { hasText: group })).toContainText("1 attached");
  await page.getByRole("link", { name: group }).click();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  d = await openModal(page, "Add users");
  await d.getByLabel(user).check();
  await d.getByRole("button", { name: "Add users" }).click();
  await expectFlash(page, `Users added to ${group}`);
  await expect(page.locator("td a", { hasText: user })).toBeVisible();
  await go(page, `/iam/groups/${group}?tab=permissions`);
  d = await openModal(page, "Create inline policy");
  await d.locator("input[name=policyName]").fill("group-inline");
  await d.locator("textarea[name=document]").fill(inline);
  await d.getByRole("button", { name: "Create policy" }).click();
  await expectFlash(page, "Inline policy group-inline saved");
  await expect(page.locator("td", { hasText: "group-inline" })).toBeVisible();

  // User: groups tab, inline policy, boundary, tags, credentials
  await go(page, `/iam/users/${user}?tab=groups`);
  await expect(page.locator("td a", { hasText: group })).toBeVisible();
  await go(page, `/iam/users/${user}`);
  d = await openModal(page, "Create inline policy");
  await d.locator("input[name=policyName]").fill("user-inline");
  await d.locator("textarea[name=document]").fill(inline);
  await d.getByRole("button", { name: "Create policy" }).click();
  await expectFlash(page, "Inline policy user-inline saved");
  d = await openModal(page, "Set boundary");
  await d.locator("input[name=boundary]").fill("arn:aws:iam::aws:policy/PowerUserAccess");
  await d.getByRole("button", { name: "Set boundary" }).click();
  await expectFlash(page, "Permissions boundary set");
  await expect(page.locator("dd", { hasText: "PowerUserAccess" }).first()).toBeVisible();
  await go(page, `/iam/users/${user}?tab=tags`);
  d = await openModal(page, "Add tag");
  await d.locator("input[name=key]").fill("team");
  await d.getByRole("button", { name: "Add tag" }).click();
  await expectFlash(page, "Tag added");
  await go(page, `/iam/users/${user}?tab=credentials`);
  await page.getByRole("button", { name: "Create access key" }).click();
  await expect(page.getByText("Access key created")).toBeVisible();
  await go(page, `/iam/users/${user}?tab=credentials`);
  await page.locator("#keys-form ~ div input[data-select], input[form=keys-form][data-select]").first().check();
  await page.getByRole("button", { name: "Deactivate" }).click();
  await expectFlash(page, "Access key deactivated");
  await expect(page.locator("td", { hasText: "Inactive" })).toBeVisible();
  d = await openModal(page, "Enable console access");
  await d.locator("input[name=password]").fill("Consolation-Pass-123!");
  await d.getByRole("button", { name: "Save" }).click();
  await expectFlash(page, "Console password saved");
  await expect(page.locator("dd", { hasText: "Enabled" })).toBeVisible();

  // Role: trust policy, edit, instance profile
  await go(page, "/iam/roles");
  d = await openModal(page, "Create role");
  await d.locator("input[name=name]").fill(role);
  await d.getByRole("button", { name: "Create role" }).click();
  await expectFlash(page, `Role ${role} created`);
  await go(page, `/iam/roles/${role}`);
  d = await openModal(page, "Edit");
  await d.locator("input[name=maxSession]").fill("4");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, `Role ${role} updated`);
  await expect(page.locator("dd", { hasText: "4 hour" })).toBeVisible();
  await go(page, `/iam/roles/${role}?tab=trust`);
  d = await openModal(page, "Edit trust policy");
  // Trust EC2 and the account itself, so the STS playground can assume the role.
  await d.locator("textarea[name=document]").fill('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com","AWS":"arn:aws:iam::000000000000:root"},"Action":"sts:AssumeRole"}]}');
  await d.getByRole("button", { name: "Update policy" }).click();
  await expectFlash(page, "Trust policy updated");
  await expect(page.locator("pre", { hasText: "ec2.amazonaws.com" })).toBeVisible();
  await go(page, `/iam/roles/${role}?tab=instance-profiles`);
  d = await openModal(page, "Create instance profile");
  await d.getByRole("button", { name: "Create instance profile" }).click();
  await expectFlash(page, `Instance profile ${role} created`);

  // STS AssumeRole
  await go(page, "/iam/sts");
  await page.locator("select[name=role]").selectOption({ label: role });
  await page.getByRole("button", { name: "Assume role" }).click();
  await expect(page.getByText("AssumedRoleArn")).toBeVisible();
  await expect(page.getByText("AWS_SESSION_TOKEN")).toBeVisible();

  // Customer managed policy: new version, set default back to v1, delete v2
  await go(page, "/iam/policies?scope=Local");
  d = await openModal(page, "Create policy");
  await d.locator("input[name=name]").fill(policy);
  await d.getByRole("button", { name: "Create policy" }).click();
  await expectFlash(page, `Policy ${policy} created`);
  await page.getByRole("link", { name: policy }).click();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  d = await openModal(page, "Edit");
  await d.locator("textarea[name=document]").fill(inline);
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, "New policy version saved");
  await expect(page.getByText("Policy version v2 (default)")).toBeVisible();
  await page.getByRole("link", { name: "Policy versions" }).click();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await selectRow(page, "v1");
  await page.getByRole("button", { name: "Set as default" }).click();
  await expectFlash(page, "Version v1 set as default");
  await selectRow(page, "v2");
  await page.getByRole("button", { name: "Delete", exact: true }).nth(1).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Policy version deleted");
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await confirmDialog(page, "delete");
  await expectFlash(page, `Policy ${policy} deleted`);

  // Identity provider and account settings
  await go(page, "/iam/identity-providers");
  d = await openModal(page, "Add OpenID Connect provider");
  await d.locator("input[name=url]").fill("https://token.example.test");
  await d.locator("input[name=audiences]").fill("sts.amazonaws.com");
  await d.getByRole("button", { name: "Add provider" }).click();
  await expectFlash(page, "Identity provider https://token.example.test added");
  await selectRow(page, "token.example.test");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Identity provider deleted");
  await go(page, "/iam/account-settings");
  d = await openModal(page, "Edit");
  await d.locator("input[name=minLength]").fill("14");
  await d.locator("input[name=symbols]").check();
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, "Password policy updated");
  await expect(page.locator("dd", { hasText: "14 characters" })).toBeVisible();
  await page.getByRole("button", { name: "Reset to IAM default" }).click();
  await expectFlash(page, "Password policy reset");

  // Clean up (deleting the user and role also removes inline policies, memberships and profiles)
  await go(page, "/iam/groups");
  await selectRow(page, group);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, `User group ${group} deleted`);
  await go(page, "/iam/users");
  await selectRow(page, user);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, `User ${user} deleted`);
  await go(page, "/iam/roles");
  await selectRow(page, role);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, `Role ${role} deleted`);
});

test("CloudWatch Logs: retention, metric filters, search, Insights, saved queries, export and tags", async ({ page }) => {
  const group = uid("e2e-logs");
  const bucket = uid("e2e-export");
  const enc = encodeURIComponent(group);
  await go(page, "/cloudwatch/log-groups");
  let d = await openModal(page, "Create log group");
  await d.locator("input[name=name]").fill(group);
  await d.getByRole("button", { name: "Create" }).click();
  await expectFlash(page, `Log group ${group} has been created`);

  await go(page, `/cloudwatch/log-groups/${enc}`);
  d = await openModal(page, "Create log stream");
  await d.locator("input[name=name]").fill("app");
  await d.getByRole("button", { name: "Create" }).click();
  await expectFlash(page, "Log stream app created");
  await go(page, `/cloudwatch/log-groups/${enc}?stream=app`);
  d = await openModal(page, "Put log events");
  await d.locator("textarea[name=message]").fill("ERROR payment failed id=42\nINFO request ok\nERROR timeout id=7");
  await d.getByRole("button", { name: "Put events" }).click();
  await expectFlash(page, "Put 3 log events");
  await expect(page.locator("td pre", { hasText: "payment failed" })).toBeVisible();
  await page.getByRole("link", { name: "1h", exact: true }).click();
  await expect(page.locator("td pre", { hasText: "timeout id=7" })).toBeVisible();

  // Retention
  await go(page, `/cloudwatch/log-groups/${enc}`);
  d = await openModal(page, "Edit");
  await d.locator("select[name=retention]").selectOption("14");
  await d.getByRole("button", { name: "Save" }).click();
  await expectFlash(page, `Log group ${group} updated`);
  await expect(page.locator("dd", { hasText: "14 days" })).toBeVisible();

  // Search across streams
  await go(page, `/cloudwatch/log-groups/${enc}?view=search`);
  await page.locator("input[name=pattern]").fill("ERROR");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.locator("td pre", { hasText: "payment failed" })).toBeVisible();
  await expect(page.locator("td pre", { hasText: "request ok" })).toHaveCount(0);

  // Metric filter + pattern test
  await go(page, `/cloudwatch/log-groups/${enc}?tab=metric-filters`);
  d = await openModal(page, "Create metric filter");
  await d.locator("input[name=pattern]").fill("ERROR");
  await d.locator("input[name=name]").fill("errors");
  await d.locator("input[name=metric]").fill("ErrorCount");
  await d.getByRole("button", { name: "Create metric filter" }).click();
  await expectFlash(page, "Metric filter errors saved");
  await expect(page.locator("td", { hasText: "LogMetrics / ErrorCount" })).toBeVisible();
  await page.getByLabel("Filter pattern to test").fill("ERROR");
  await page.getByRole("button", { name: "Test pattern" }).click();
  await expect(page.getByText("1 match: line 1")).toBeVisible();

  // Logs Insights, then save the query
  await go(page, `/cloudwatch/logs-insights?group=${enc}`);
  await page.getByLabel("Query").fill("fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc");
  await page.getByRole("button", { name: "Run query" }).click();
  await expect(page.locator("td", { hasText: "payment failed" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("td", { hasText: "request ok" })).toHaveCount(0);
  d = await openModal(page, "Save");
  await d.locator("input[name=name]").fill(`${group}/errors`);
  await d.getByRole("button", { name: "Save" }).click();
  await expectFlash(page, `Query ${group}/errors saved`);
  await expect(page.getByRole("link", { name: `${group}/errors` })).toBeVisible();
  await page.getByRole("button", { name: `Delete ${group}/errors` }).click();
  await expectFlash(page, "Saved query deleted");

  // Export to a new bucket (the bucket policy is added by the export dialog)
  await go(page, "/s3/buckets/create");
  await page.locator("input[name=name]").fill(bucket);
  await page.getByRole("button", { name: "Create bucket" }).click();
  await expectFlash(page, `Successfully created bucket "${bucket}"`);
  await go(page, `/cloudwatch/log-groups/${enc}`);
  d = await openModal(page, "Export data to Amazon S3");
  await d.locator("select[name=bucket]").selectOption(bucket);
  await d.getByRole("button", { name: "Export" }).click();
  await expectFlash(page, `Export task for ${group} created`);
  await go(page, `/cloudwatch/log-groups/${enc}?tab=exports`);
  await expect(page.locator("td", { hasText: `s3://${bucket}/` })).toBeVisible();

  // Tags
  await go(page, `/cloudwatch/log-groups/${enc}?tab=tags`);
  d = await openModal(page, "Add tag");
  await d.locator("input[name=key]").fill("app");
  await d.getByRole("button", { name: "Add tag" }).click();
  await expectFlash(page, "Tag added");
  await expect(page.locator("td", { hasText: "app" }).first()).toBeVisible();

  // Clean up
  await go(page, "/cloudwatch/log-groups");
  await selectRow(page, group);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, `Log group ${group} deleted`);
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

test("EC2: instance details, connect, type change, volumes, snapshots, templates, EIPs, rules, ENIs and placement groups", async ({ page }) => {
  const name = uid("e2e-vm");
  const sshKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBl8Dk5wDCJ0zVd1P8aJx7pZ6u0zD3P0Yz7XoKcV0Zq9 e2e@test";

  // Launch with user data
  await go(page, "/ec2/instances/launch");
  await page.locator("input[name=name]").fill(name);
  await page.locator("textarea[name=userData]").fill("#!/bin/bash\necho hello-e2e");
  await page.getByRole("button", { name: "Launch instance" }).click();
  await expectFlash(page, "Successfully initiated launch");
  await page.locator("tr", { hasText: name }).locator("a").first().click();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.locator("pre", { hasText: "echo hello-e2e" })).toBeVisible();
  const id = page.url().split("/").pop()!.split("?")[0];

  // Connect: push a key while running
  await page.getByRole("link", { name: "Connect" }).click();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await page.locator("textarea[name=key]").fill(sshKey);
  await page.getByRole("button", { name: "Push key" }).click();
  await expect(page.getByText("Key pushed")).toBeVisible();

  // Tags
  await go(page, `/ec2/instances/${id}?tab=tags`);
  let d = await openModal(page, "Add tag");
  await d.locator("input[name=key]").fill("env");
  await d.locator("input[name=value]").fill("e2e");
  await d.getByRole("button", { name: "Add tag" }).click();
  await expectFlash(page, "Tag added");
  await expect(page.locator("td", { hasText: "env" })).toBeVisible();

  // Stop, then change instance type
  await go(page, `/ec2/instances/${id}`);
  await page.getByRole("button", { name: "Stop instance" }).click();
  await expectFlash(page, `Successfully requested stop of ${id}`);
  await expect(async () => {
    await page.reload();
    await expect(page.locator("dd", { hasText: "stopped" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  d = await openModal(page, "Change instance type");
  await d.locator("select[name=type]").selectOption("t3.small");
  await d.getByRole("button", { name: "Apply" }).click();
  await expectFlash(page, `Instance type of ${id} changed`);
  await expect(page.locator("dd", { hasText: "t3.small" })).toBeVisible();

  // Volume in the instance's AZ, attach, snapshot, detach, delete
  await go(page, `/ec2/instances/${id}?tab=networking`);
  const zone = (await page.locator("dt", { hasText: "Availability Zone" }).locator("xpath=following-sibling::dd[1]").innerText()).trim();
  await go(page, "/ec2/volumes");
  d = await openModal(page, "Create volume");
  await d.locator("input[name=size]").fill("5");
  await d.locator("select[name=az]").selectOption(zone);
  await d.locator("input[name=name]").fill(`${name}-vol`);
  await d.getByRole("button", { name: "Create volume" }).click();
  await expectFlash(page, "Volume created");
  await expect(page.locator("tr", { hasText: `${name}-vol` })).toBeVisible();
  const volId = (await page.locator("tr", { hasText: `${name}-vol` }).locator("td").nth(2).innerText()).trim();
  await expect(async () => {
    await page.reload();
    await expect(page.locator("tr", { hasText: volId })).toContainText("available", { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  d = await openModal(page, "Attach volume");
  await d.locator("select[name=volume]").selectOption(volId);
  await d.locator("select[name=instance]").selectOption(id);
  await d.getByRole("button", { name: "Attach volume" }).click();
  await expectFlash(page, "Volume attached");
  await expect(page.locator("tr", { hasText: volId })).toContainText(id);
  d = await openModal(page, "Create snapshot");
  await d.locator("select[name=volume]").selectOption(volId);
  await d.locator("input[name=description]").fill(`${name}-snap`);
  await d.getByRole("button", { name: "Create snapshot" }).click();
  await expectFlash(page, "Snapshot created");
  await go(page, "/ec2/snapshots");
  await expect(page.locator("tr", { hasText: `${name}-snap` })).toBeVisible();
  await selectRow(page, `${name}-snap`);
  await page.getByRole("button", { name: "Delete snapshot" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Snapshot deleted");
  await go(page, "/ec2/volumes");
  await selectRow(page, volId);
  await page.getByRole("button", { name: "Detach volume" }).click();
  await confirmDialog(page, "detach");
  await expectFlash(page, "Volume detached");
  await expect(async () => {
    await page.reload();
    await expect(page.locator("tr", { hasText: volId })).toContainText("available", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await selectRow(page, volId);
  await page.getByRole("button", { name: "Delete volume" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Volume deleted");

  // Security group rule
  await go(page, "/ec2/security-groups");
  const sgId = (await page.locator("tbody tr").first().locator("a").first().innerText()).trim();
  await go(page, `/ec2/security-groups/${sgId}`);
  d = await openModal(page, "Add inbound rule");
  await d.locator("input[name=from]").fill("8443");
  await d.locator("input[name=source]").fill("10.9.0.0/16");
  await d.locator("input[name=description]").fill("e2e-rule");
  await d.getByRole("button", { name: "Save rule" }).click();
  await expectFlash(page, "Inbound rule added");
  await expect(page.locator("tr", { hasText: "e2e-rule" })).toContainText("8443");
  await selectRow(page, "e2e-rule");
  await page.getByRole("button", { name: "Delete rules" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Rules removed");
  await expect(page.locator("tr", { hasText: "e2e-rule" })).toHaveCount(0);

  // Launch template with a second version
  const tpl = uid("e2e-tpl");
  await go(page, "/ec2/launch-templates");
  d = await openModal(page, "Create launch template");
  await d.locator("input[name=name]").fill(tpl);
  await d.locator("select[name=ami]").selectOption({ index: 1 });
  await d.locator("select[name=type]").selectOption("t3.micro");
  await d.getByRole("button", { name: "Create launch template" }).click();
  await expectFlash(page, `Launch template ${tpl} created`);
  await page.locator("tr", { hasText: tpl }).locator("a").click();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  d = await openModal(page, "Modify template (Create new version)");
  await d.locator("select[name=type]").selectOption("t3.small");
  await d.getByRole("button", { name: "Create template version" }).click();
  await expectFlash(page, "New template version created");
  await page.getByLabel("Select 2", { exact: true }).check();
  await page.getByRole("button", { name: "Set default version" }).click();
  await expectFlash(page, "Version 2 is now the default");
  await page.getByRole("button", { name: "Delete template" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Launch template deleted");

  // Elastic IP
  await go(page, "/ec2/elastic-ips");
  d = await openModal(page, "Allocate Elastic IP address");
  await d.locator("input[name=name]").fill(`${name}-eip`);
  await d.getByRole("button", { name: "Allocate" }).click();
  await expectFlash(page, "Elastic IP address allocated");
  const eipRow = page.locator("tr", { hasText: `${name}-eip` });
  await expect(eipRow).toBeVisible();
  const alloc = (await eipRow.locator("td").nth(3).innerText()).trim();
  d = await openModal(page, "Associate Elastic IP address");
  await d.locator("select[name=allocation]").selectOption(alloc);
  await d.locator("select[name=target]").selectOption(id);
  await d.getByRole("button", { name: "Associate" }).click();
  await expectFlash(page, "Elastic IP address associated");
  await expect(page.locator("tr", { hasText: `${name}-eip` })).toContainText(id);
  await page.locator("tr", { hasText: `${name}-eip` }).locator("input[form=eip-disassociate]").check();
  await page.getByRole("button", { name: "Disassociate", exact: true }).click();
  await confirmDialog(page, "disassociate");
  await expectFlash(page, "Elastic IP address disassociated");
  await selectRow(page, `${name}-eip`);
  await page.getByRole("button", { name: "Release", exact: true }).click();
  await confirmDialog(page, "release");
  await expectFlash(page, "Elastic IP address released");

  // Placement group and network interface
  const pg = uid("e2e-pg");
  await go(page, "/ec2/placement-groups");
  d = await openModal(page, "Create placement group");
  await d.locator("input[name=name]").fill(pg);
  await d.locator("select[name=strategy]").selectOption("spread");
  await d.getByRole("button", { name: "Create group" }).click();
  await expectFlash(page, `Placement group ${pg} created`);
  await selectRow(page, pg);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Placement group deleted");
  await go(page, "/ec2/network-interfaces");
  d = await openModal(page, "Create network interface");
  await d.locator("input[name=description]").fill(`${name}-eni`);
  await d.getByRole("button", { name: "Create network interface" }).click();
  await expectFlash(page, "Network interface created");
  await selectRow(page, `${name}-eni`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Network interface deleted");

  // Terminate
  await go(page, `/ec2/instances/${id}`);
  await page.getByRole("button", { name: "Terminate instance" }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, `Successfully requested terminate of ${id}`);
});

test("S3, DynamoDB and Lambda leftovers: Object Lock, notifications, replication, inventory, access points, exports, imports, monitor and container images", async ({ page }) => {
  const locked = uid("e2e-lock");
  const plain = uid("e2e-dest");
  const queue = uid("e2e-s3q");
  const table = uid("e2e-ddb");
  const imported = uid("e2e-imp");
  const ap = uid("e2e-ap");

  // Buckets: one with Object Lock (versioned), one versioned destination
  for (const [b, lock] of [[locked, true], [plain, false]] as const) {
    await go(page, "/s3/buckets/create");
    await page.locator("input[name=name]").fill(b);
    await page.locator("input[name=versioning][value=on]").check();
    if (lock) await page.locator("input[name=objectLock][value=on]").check();
    await page.getByRole("button", { name: "Create bucket" }).click();
    await expectFlash(page, `Successfully created bucket "${b}"`);
  }
  await createQueue(page, queue);

  // Object Lock default retention + event notification to SQS
  await go(page, `/s3/buckets/${locked}?tab=properties`);
  await expect(page.locator("dd", { hasText: "Enabled" }).first()).toBeVisible();
  let d = await openModal(page, "Edit");
  await d.locator("select[name=mode]").selectOption("GOVERNANCE");
  await d.locator("input[name=period]").fill("2");
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, "Object Lock settings saved");
  await expect(page.locator("dd", { hasText: "2 days" })).toBeVisible();
  d = await openModal(page, "Edit event notifications");
  await d.locator("textarea[name=json]").fill(JSON.stringify({ QueueConfigurations: [{ Id: "new-objects", QueueArn: `arn:aws:sqs:us-east-1:000000000000:${queue}`, Events: ["s3:ObjectCreated:*"] }] }));
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, "Event notifications saved");
  await expect(page.locator("td", { hasText: "new-objects" })).toBeVisible();

  // Replication and inventory
  await go(page, `/s3/buckets/${locked}?tab=management`);
  d = await openModal(page, "Edit replication");
  await d.locator("textarea[name=json]").fill(
    JSON.stringify({ Role: "arn:aws:iam::000000000000:role/s3-replication", Rules: [{ ID: "to-dest", Status: "Enabled", Priority: 1, Filter: {}, DeleteMarkerReplication: { Status: "Disabled" }, Destination: { Bucket: `arn:aws:s3:::${plain}` } }] }),
  );
  await d.getByRole("button", { name: "Save changes" }).click();
  await expectFlash(page, "Replication configuration saved");
  await expect(page.locator("td", { hasText: "to-dest" })).toBeVisible();
  d = await openModal(page, "Create inventory configuration");
  await d.locator("input[name=id]").fill("weekly-inv");
  await d.locator("input[name=destination]").fill(plain);
  await d.locator("select[name=frequency]").selectOption("Weekly");
  await d.getByRole("button", { name: "Create" }).click();
  await expectFlash(page, "Inventory configuration weekly-inv saved");
  await expect(page.locator("td", { hasText: "weekly-inv" })).toBeVisible();

  // Access point
  await go(page, "/s3/access-points");
  d = await openModal(page, "Create access point");
  await d.locator("input[name=name]").fill(ap);
  await d.locator("select[name=bucket]").selectOption(plain);
  await d.getByRole("button", { name: "Create access point" }).click();
  await expectFlash(page, `Access point ${ap} created`);
  await page.getByRole("link", { name: ap }).click();
  await expect(page.locator("dd", { hasText: plain })).toBeVisible();
  await page.waitForSelector("html[data-hydrated]", { state: "attached" });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, "Access point deleted");

  // DynamoDB: export to S3 (turns on PITR), then import into a new table
  await go(page, "/dynamodb/tables/create");
  await page.locator("input[name=name]").fill(table);
  await page.locator("input[name=pk]").fill("pk");
  await page.getByRole("button", { name: "Create table" }).click();
  await expectFlash(page, table);
  await expect(async () => {
    await go(page, `/dynamodb/tables/${table}?tab=streams`);
    await expect(page.getByRole("button", { name: "Export to S3" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  d = await openModal(page, "Export to S3");
  await d.locator("select[name=bucket]").selectOption(plain);
  await d.locator("input[name=prefix]").fill("ddb");
  await d.getByRole("button", { name: "Export" }).click();
  await expectFlash(page, `Export of ${table} started`);
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Completed")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await go(page, `/dynamodb/tables/${table}?tab=monitor`);
  await expect(page.getByText("Read usage (consumed RCUs)")).toBeVisible();
  await go(page, "/dynamodb/imports");
  d = await openModal(page, "Import from S3");
  await d.locator("select[name=bucket]").selectOption(plain);
  await d.locator("input[name=prefix]").fill("ddb/AWSDynamoDB/");
  await d.locator("input[name=name]").fill(imported);
  await d.locator("input[name=pk]").fill("pk");
  await d.getByRole("button", { name: "Import" }).click();
  await expectFlash(page, `Import into new table ${imported} started`);
  await expect(page.locator("tr", { hasText: imported })).toBeVisible();

  // Lambda from a container image pushed to ECR
  const repo = uid("e2e-repo");
  const imageUri = await pushTestImage(repo);
  const fn = uid("e2e-imgfn");
  await go(page, "/lambda/functions/create");
  await page.locator("input[name=packageType][value=Image]").check();
  await page.locator("input[name=name]").fill(fn);
  await page.locator("input[name=imageUri]").fill(imageUri);
  await page.getByRole("button", { name: "Create function" }).click();
  await expectFlash(page, `Successfully created the function ${fn}`);
  await expect(page.locator("dd", { hasText: "Image" }).first()).toBeVisible();
  await expect(page.locator("dd", { hasText: imageUri })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deploy new image" })).toBeVisible();

  // Clean up
  await go(page, "/lambda/functions");
  await selectRow(page, fn);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, `Successfully deleted function ${fn}`);
  await deleteTestRepository(repo);
  await go(page, "/dynamodb/tables");
  for (const t of [table, imported]) await selectRow(page, t);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "deleted");
  await go(page, "/sqs/queues");
  await selectRow(page, queue);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "deleted");
  // Empty removes every version, so versioned buckets can then be deleted.
  for (const b of [plain, locked]) {
    await go(page, "/s3/buckets");
    await selectRow(page, b);
    await page.getByRole("button", { name: "Empty", exact: true }).click();
    await confirmDialog(page, "permanently delete");
    await expectFlash(page, "Successfully emptied");
    await selectRow(page, b);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await confirmDialog(page, "delete");
    await expectFlash(page, `Successfully deleted bucket "${b}"`);
  }
});

test("EventBridge: a rule with an SQS target delivers once the queue policy allows it", async ({ page }) => {
  const queue = uid("e2e-ebq");
  const rule = uid("e2e-ebrule");
  await createQueue(page, queue);
  await go(page, "/eventbridge/rules/create");
  await page.locator("input[name=name]").fill(rule);
  await page.locator("textarea[name=pattern]").fill('{"source": ["e2e.consolation"]}');
  await page.locator("input[name=target]").fill(`arn:aws:sqs:us-east-1:000000000000:${queue}`);
  await page.getByRole("button", { name: "Create rule" }).click();
  await expectFlash(page, `Rule ${rule} was created successfully`);
  await go(page, "/eventbridge/send");
  await page.locator("input[name=source]").fill("e2e.consolation");
  await page.locator("textarea[name=detail]").fill('{"hello": "from-e2e"}');
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/sent|Event ID|successfully/i).first()).toBeVisible();
  await go(page, `/sqs/queues/${queue}?tab=messages`);
  await expect(async () => {
    await page.getByRole("button", { name: "Poll for messages" }).click();
    await expect(page.locator("td pre", { hasText: "from-e2e" })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20_000 });

  await go(page, "/eventbridge/rules");
  await selectRow(page, rule);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "delete");
  await expectFlash(page, `Rule ${rule} deleted`);
  await go(page, "/sqs/queues");
  await selectRow(page, queue);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page, "confirm");
  await expectFlash(page, "deleted");
});
