"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateClusterCommand,
  CreateServiceCommand,
  DeleteClusterCommand,
  DeleteServiceCommand,
  DeregisterTaskDefinitionCommand,
  RegisterTaskDefinitionCommand,
  RunTaskCommand,
  StopTaskCommand,
  UpdateServiceCommand,
  type Compatibility,
  type LaunchType,
  type NetworkMode,
  type RegisterTaskDefinitionCommandInput,
} from "@aws-sdk/client-ecs";
import { DescribeSecurityGroupsCommand, DescribeSubnetsCommand } from "@aws-sdk/client-ec2";
import { aws, errorMessage, type Clients } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const cp = (name: string) => `/ecs/clusters/${encodeURIComponent(name)}`;

async function guard(ok: string, paths: string[], fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  paths.forEach((p) => revalidatePath(p));
}

/** Default-VPC networking for awsvpc tasks, as the console pre-fills it. */
async function defaultNetwork(ec2: Clients["ec2"]) {
  const subnets = ((await ec2.send(new DescribeSubnetsCommand({ Filters: [{ Name: "default-for-az", Values: ["true"] }] }))).Subnets ?? []).map((s) => s.SubnetId!);
  const sgs = ((await ec2.send(new DescribeSecurityGroupsCommand({ Filters: [{ Name: "group-name", Values: ["default"] }] }))).SecurityGroups ?? []).map((g) => g.GroupId!);
  return { awsvpcConfiguration: { subnets: subnets.slice(0, 3), securityGroups: sgs.slice(0, 1), assignPublicIp: "ENABLED" as const } };
}

export async function createCluster(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const { ecs } = await aws();
  await guard(`Cluster ${name} has been created successfully.`, ["/ecs/clusters"], () =>
    ecs.send(new CreateClusterCommand({ clusterName: name, capacityProviders: ["FARGATE", "FARGATE_SPOT"], settings: [{ name: "containerInsights", value: fd.get("insights") === "on" ? "enabled" : "disabled" }] })),
  );
}

export async function deleteClusters(fd: FormData) {
  const { ecs } = await aws();
  for (const c of fd.getAll("selected").map(String)) await guard(`Cluster ${c} deleted.`, ["/ecs/clusters"], () => ecs.send(new DeleteClusterCommand({ cluster: c })));
  if (fd.get("from") === "detail") redirect("/ecs/clusters");
}

export async function registerTaskDef(fd: FormData) {
  const family = String(fd.get("family") ?? "").trim();
  try {
    const { ecs } = await aws();
    const json = String(fd.get("json") ?? "").trim();
    let input: RegisterTaskDefinitionCommandInput;
    if (json) {
      input = JSON.parse(json);
    } else {
      const port = Number(fd.get("port") || 0);
      const env = String(fd.get("env") ?? "")
        .split(/\r?\n/)
        .filter((l) => l.includes("="))
        .map((l) => ({ name: l.slice(0, l.indexOf("=")).trim(), value: l.slice(l.indexOf("=") + 1).trim() }));
      input = {
        family,
        requiresCompatibilities: [String(fd.get("launchType") || "FARGATE") as Compatibility],
        networkMode: String(fd.get("networkMode") || "awsvpc") as NetworkMode,
        cpu: String(fd.get("cpu") || "256"),
        memory: String(fd.get("memory") || "512"),
        containerDefinitions: [
          {
            name: String(fd.get("container") || family),
            image: String(fd.get("image")),
            essential: true,
            ...(port ? { portMappings: [{ containerPort: port, protocol: "tcp" }] } : {}),
            ...(env.length ? { environment: env } : {}),
          },
        ],
      };
    }
    const r = await ecs.send(new RegisterTaskDefinitionCommand(input));
    await flash("success", `Task definition ${r.taskDefinition?.family}:${r.taskDefinition?.revision} registered.`);
    redirect(`/ecs/task-definitions/${encodeURIComponent(r.taskDefinition!.family!)}`);
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    await flash("error", `Failed to register task definition. ${errorMessage(e)}`);
    revalidatePath("/ecs/task-definitions/create");
  }
}

export async function deregisterTaskDefs(fd: FormData) {
  const { ecs } = await aws();
  for (const td of fd.getAll("selected").map(String)) await guard(`Deregistered ${td.split("/").pop()}.`, ["/ecs/task-definitions"], () => ecs.send(new DeregisterTaskDefinitionCommand({ taskDefinition: td })));
  revalidatePath(`/ecs/task-definitions/${encodeURIComponent(String(fd.get("family") ?? ""))}`);
}

export async function createService(fd: FormData) {
  const cluster = String(fd.get("cluster"));
  const { ecs, ec2 } = await aws();
  await guard("Service created.", [cp(cluster)], async () =>
    ecs.send(
      new CreateServiceCommand({
        cluster,
        serviceName: String(fd.get("name")),
        taskDefinition: String(fd.get("taskDefinition")),
        desiredCount: Number(fd.get("desired") || 1),
        launchType: String(fd.get("launchType") || "FARGATE") as LaunchType,
        networkConfiguration: await defaultNetwork(ec2),
      }),
    ),
  );
}

export async function scaleService(fd: FormData) {
  const cluster = String(fd.get("cluster"));
  const { ecs } = await aws();
  for (const s of fd.getAll("selected").map(String))
    await guard(`Service ${s.split("/").pop()} updated.`, [cp(cluster)], () => ecs.send(new UpdateServiceCommand({ cluster, service: s, desiredCount: Number(fd.get("desired") ?? 0) })));
}

export async function deleteServices(fd: FormData) {
  const cluster = String(fd.get("cluster"));
  const { ecs } = await aws();
  for (const s of fd.getAll("selected").map(String)) await guard(`Service ${s.split("/").pop()} deleted.`, [cp(cluster)], () => ecs.send(new DeleteServiceCommand({ cluster, service: s, force: true })));
}

export async function runTask(fd: FormData) {
  const cluster = String(fd.get("cluster"));
  const { ecs, ec2 } = await aws();
  await guard("Task started.", [cp(cluster)], async () => {
    const r = await ecs.send(
      new RunTaskCommand({ cluster, taskDefinition: String(fd.get("taskDefinition")), count: Number(fd.get("count") || 1), launchType: String(fd.get("launchType") || "FARGATE") as LaunchType, networkConfiguration: await defaultNetwork(ec2) }),
    );
    if (r.failures?.length) throw new Error(r.failures.map((f) => `${f.arn ?? ""} ${f.reason}`).join("; "));
  });
}

export async function stopTasks(fd: FormData) {
  const cluster = String(fd.get("cluster"));
  const { ecs } = await aws();
  for (const t of fd.getAll("selected").map(String)) await guard(`Task ${t.split("/").pop()} stopped.`, [cp(cluster)], () => ecs.send(new StopTaskCommand({ cluster, task: t, reason: "Stopped from Consolation" })));
}
