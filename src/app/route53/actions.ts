"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ChangeResourceRecordSetsCommand,
  CreateHealthCheckCommand,
  CreateHostedZoneCommand,
  DeleteHealthCheckCommand,
  DeleteHostedZoneCommand,
  ListResourceRecordSetsCommand,
  type HealthCheckType,
  type ResourceRecordSet,
  type RRType,
} from "@aws-sdk/client-route-53";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";

const zp = (id: string) => `/route53/hosted-zones/${encodeURIComponent(id)}`;
const fqdn = (n: string) => (n.endsWith(".") ? n : `${n}.`);

async function guard(ok: string, path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  revalidatePath(path);
}

export async function createZone(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  let id = "";
  try {
    const { route53 } = await aws();
    const priv = fd.get("type") === "private";
    const vpc = String(fd.get("vpc") ?? "").trim();
    const r = await route53.send(
      new CreateHostedZoneCommand({
        Name: name,
        CallerReference: `consolation-${Date.now()}`,
        HostedZoneConfig: { Comment: String(fd.get("comment") ?? "") || undefined, PrivateZone: priv },
        ...(priv && vpc ? { VPC: { VPCId: vpc, VPCRegion: "us-east-1" } } : {}),
      }),
    );
    id = r.HostedZone!.Id!.replace("/hostedzone/", "");
  } catch (e) {
    await flash("error", `Failed to create hosted zone ${name}. ${errorMessage(e)}`);
    revalidatePath("/route53/hosted-zones");
    return;
  }
  await flash("success", `Hosted zone ${name} was successfully created.`);
  redirect(zp(id));
}

export async function deleteZones(fd: FormData) {
  const { route53 } = await aws();
  for (const id of fd.getAll("selected").map(String)) {
    await guard(`Hosted zone ${id} deleted.`, "/route53/hosted-zones", async () => {
      // Delete every record except the zone apex NS and SOA first, as the console does.
      const recs = (await route53.send(new ListResourceRecordSetsCommand({ HostedZoneId: id }))).ResourceRecordSets ?? [];
      const apex = recs.find((r) => r.Type === "SOA")?.Name;
      const extra = recs.filter((r) => !(r.Name === apex && (r.Type === "NS" || r.Type === "SOA")));
      if (extra.length) await route53.send(new ChangeResourceRecordSetsCommand({ HostedZoneId: id, ChangeBatch: { Changes: extra.map((r) => ({ Action: "DELETE", ResourceRecordSet: r })) } }));
      await route53.send(new DeleteHostedZoneCommand({ Id: id }));
    });
  }
  if (fd.get("from") === "detail") redirect("/route53/hosted-zones");
}

export async function upsertRecord(fd: FormData) {
  const zone = String(fd.get("zone"));
  const zoneName = String(fd.get("zoneName"));
  const sub = String(fd.get("name") ?? "").trim();
  const name = sub ? `${sub}.${zoneName}` : zoneName;
  const type = String(fd.get("type")) as RRType;
  const { route53 } = await aws();
  await guard(`Record ${name} ${type} saved.`, zp(zone), () => {
    const alias = fd.get("alias") === "on";
    const setId = String(fd.get("setId") ?? "").trim();
    const weight = String(fd.get("weight") ?? "").trim();
    const rrs: ResourceRecordSet = {
      Name: fqdn(name),
      Type: type,
      ...(setId ? { SetIdentifier: setId, Weight: Number(weight || 0) } : {}),
      ...(alias
        ? { AliasTarget: { DNSName: String(fd.get("aliasTarget")), HostedZoneId: String(fd.get("aliasZone") || zone), EvaluateTargetHealth: false } }
        : {
            TTL: Number(fd.get("ttl") || 300),
            ResourceRecords: String(fd.get("value") ?? "")
              .split(/\r?\n/)
              .map((v) => v.trim())
              .filter(Boolean)
              .map((Value) => ({ Value })),
          }),
    };
    return route53.send(new ChangeResourceRecordSetsCommand({ HostedZoneId: zone, ChangeBatch: { Changes: [{ Action: "UPSERT", ResourceRecordSet: rrs }] } }));
  });
}

export async function deleteRecords(fd: FormData) {
  const zone = String(fd.get("zone"));
  const { route53 } = await aws();
  const recs = fd.getAll("selected").map((s) => JSON.parse(String(s)) as ResourceRecordSet);
  await guard(`Deleted ${recs.length} record${recs.length === 1 ? "" : "s"}.`, zp(zone), () =>
    route53.send(new ChangeResourceRecordSetsCommand({ HostedZoneId: zone, ChangeBatch: { Changes: recs.map((r) => ({ Action: "DELETE", ResourceRecordSet: r })) } })),
  );
}

export async function createHealthCheck(fd: FormData) {
  const { route53 } = await aws();
  await guard("Health check created.", "/route53/health-checks", () =>
    route53.send(
      new CreateHealthCheckCommand({
        CallerReference: `consolation-${Date.now()}`,
        HealthCheckConfig: {
          Type: String(fd.get("protocol")) as HealthCheckType,
          FullyQualifiedDomainName: String(fd.get("domain") ?? "") || undefined,
          IPAddress: String(fd.get("ip") ?? "") || undefined,
          Port: Number(fd.get("port") || 80),
          ResourcePath: String(fd.get("path") ?? "") || undefined,
          RequestInterval: 30,
          FailureThreshold: 3,
        },
      }),
    ),
  );
}

export async function deleteHealthChecks(fd: FormData) {
  const { route53 } = await aws();
  for (const id of fd.getAll("selected").map(String)) await guard(`Health check ${id} deleted.`, "/route53/health-checks", () => route53.send(new DeleteHealthCheckCommand({ HealthCheckId: id })));
}
