"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  DeleteAlarmsCommand,
  DeleteDashboardsCommand,
  DisableAlarmActionsCommand,
  EnableAlarmActionsCommand,
  PutDashboardCommand,
  PutMetricAlarmCommand,
  PutMetricDataCommand,
  SetAlarmStateCommand,
  type ComparisonOperator,
  type StateValue,
  type Statistic,
} from "@aws-sdk/client-cloudwatch";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

async function guard(ok: string, path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(path);
}

function dims(text: string) {
  return text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [Name, ...v] = p.split("=");
      return { Name: Name.trim(), Value: v.join("=").trim() };
    });
}

export async function putMetricData(fd: FormData) {
  const ns = String(fd.get("namespace"));
  const name = String(fd.get("metric"));
  const { cloudwatch } = await aws();
  const count = Math.max(1, Math.min(60, Number(fd.get("points") || 1)));
  const value = Number(fd.get("value") || 0);
  const jitter = fd.get("random") === "on";
  await guard(`Published ${count} data point${count === 1 ? "" : "s"} to ${ns}/${name}.`, "/cloudwatch/metrics", () =>
    cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: ns,
        MetricData: Array.from({ length: count }, (_, i) => ({
          MetricName: name,
          Dimensions: dims(String(fd.get("dimensions") ?? "")),
          Timestamp: new Date(Date.now() - (count - 1 - i) * 60_000),
          Value: jitter ? Math.round(value * (0.5 + Math.random()) * 100) / 100 : value,
          Unit: String(fd.get("unit") || "None") as never,
        })),
      }),
    ),
  );
}

export async function createAlarm(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const { cloudwatch } = await aws();
    const actions = String(fd.get("actions") ?? "").split(",").map((a) => a.trim()).filter(Boolean);
    await cloudwatch.send(
      new PutMetricAlarmCommand({
        AlarmName: name,
        AlarmDescription: String(fd.get("description") ?? "") || undefined,
        Namespace: String(fd.get("namespace")),
        MetricName: String(fd.get("metric")),
        Dimensions: dims(String(fd.get("dimensions") ?? "")),
        Statistic: String(fd.get("statistic") ?? "Average") as Statistic,
        Period: Number(fd.get("period") || 60),
        EvaluationPeriods: Number(fd.get("evaluation") || 1),
        Threshold: Number(fd.get("threshold") || 0),
        ComparisonOperator: String(fd.get("operator")) as ComparisonOperator,
        TreatMissingData: String(fd.get("missing") ?? "missing"),
        ...(actions.length ? { AlarmActions: actions } : {}),
      }),
    );
  } catch (e) {
    await flash("error", `Failed to create alarm ${name}. ${errorMessage(e)}`);
    redirect("/cloudwatch/alarms?create=1");
  }
  await flash("success", `Successfully created alarm ${name}.`);
  redirect(`/cloudwatch/alarms/${encodeURIComponent(name)}`);
}

export async function deleteAlarms(fd: FormData) {
  const { cloudwatch } = await aws();
  const names = fd.getAll("selected").map(String);
  await guard(`Deleted ${names.length} alarm${names.length === 1 ? "" : "s"}.`, "/cloudwatch/alarms", () => cloudwatch.send(new DeleteAlarmsCommand({ AlarmNames: names })));
  if (fd.get("from") === "detail") redirect("/cloudwatch/alarms");
}

export async function setAlarmState(fd: FormData) {
  const name = String(fd.get("name"));
  const { cloudwatch } = await aws();
  await guard(`Alarm state set to ${fd.get("state")}.`, `/cloudwatch/alarms/${encodeURIComponent(name)}`, () =>
    cloudwatch.send(new SetAlarmStateCommand({ AlarmName: name, StateValue: String(fd.get("state")) as StateValue, StateReason: String(fd.get("reason") || "Set manually from Consolation") })),
  );
}

export async function setAlarmActions(fd: FormData) {
  const name = String(fd.get("name"));
  const enable = fd.get("enable") === "true";
  const { cloudwatch } = await aws();
  await guard(enable ? "Alarm actions enabled." : "Alarm actions disabled.", `/cloudwatch/alarms/${encodeURIComponent(name)}`, () =>
    cloudwatch.send(enable ? new EnableAlarmActionsCommand({ AlarmNames: [name] }) : new DisableAlarmActionsCommand({ AlarmNames: [name] })),
  );
}

export async function saveDashboard(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  try {
    const body = String(fd.get("body") ?? "");
    JSON.parse(body);
    const { cloudwatch } = await aws();
    const r = await cloudwatch.send(new PutDashboardCommand({ DashboardName: name, DashboardBody: body }));
    if (r.DashboardValidationMessages?.length) throw new Error(r.DashboardValidationMessages.map((m) => `${m.DataPath}: ${m.Message}`).join("; "));
  } catch (e) {
    await flash("error", `Failed to save dashboard ${name}. ${errorMessage(e)}`);
    revalidatePath("/cloudwatch/dashboards");
    return;
  }
  await flash("success", `Dashboard ${name} saved.`);
  redirect(`/cloudwatch/dashboards/${encodeURIComponent(name)}`);
}

export async function deleteDashboards(fd: FormData) {
  const { cloudwatch } = await aws();
  const names = fd.getAll("selected").map(String);
  await guard(`Deleted ${names.length} dashboard${names.length === 1 ? "" : "s"}.`, "/cloudwatch/dashboards", () => cloudwatch.send(new DeleteDashboardsCommand({ DashboardNames: names })));
  if (fd.get("from") === "detail") redirect("/cloudwatch/dashboards");
}
