"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateDBClusterCommand,
  CreateDBClusterSnapshotCommand,
  CreateDBInstanceCommand,
  CreateDBSnapshotCommand,
  DeleteDBClusterCommand,
  DeleteDBClusterSnapshotCommand,
  DeleteDBInstanceCommand,
  DeleteDBSnapshotCommand,
  RebootDBInstanceCommand,
  StartDBClusterCommand,
  StartDBInstanceCommand,
  StopDBClusterCommand,
  StopDBInstanceCommand,
} from "@aws-sdk/client-rds";
import { aws, errorMessage } from "@/lib/emulator";
import { flash } from "@/lib/flash";
import { ENGINES } from "./shared";

async function guard(ok: string, paths: string[], fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  paths.forEach((p) => revalidatePath(p));
}

export async function createDatabase(fd: FormData) {
  const id = String(fd.get("id") ?? "").trim();
  const engine = String(fd.get("engine"));
  const eng = ENGINES.find((e) => e.id === engine)!;
  try {
    const { rds } = await aws();
    const common = { MasterUsername: String(fd.get("username") || "dbadmin"), ManageMasterUserPassword: true, DeletionProtection: fd.get("protect") === "on" };
    if (eng.aurora) {
      await rds.send(new CreateDBClusterCommand({ DBClusterIdentifier: id, Engine: engine, DatabaseName: String(fd.get("dbname") ?? "") || undefined, EnableHttpEndpoint: fd.get("dataApi") === "on", ...common }));
      await rds.send(new CreateDBInstanceCommand({ DBInstanceIdentifier: `${id}-instance-1`, DBClusterIdentifier: id, Engine: engine, DBInstanceClass: String(fd.get("class")) }));
    } else {
      await rds.send(
        new CreateDBInstanceCommand({
          DBInstanceIdentifier: id,
          Engine: engine,
          DBInstanceClass: String(fd.get("class")),
          AllocatedStorage: Number(fd.get("storage") || 20),
          DBName: String(fd.get("dbname") ?? "") || undefined,
          MultiAZ: fd.get("multiAz") === "on",
          PubliclyAccessible: false,
          ...common,
        }),
      );
    }
  } catch (e) {
    await flash("error", `Failed to create database ${id}. ${errorMessage(e)}`);
    redirect("/rds/databases/create");
  }
  await flash("success", `Creating database ${id}. Its master password is stored in Secrets Manager.`);
  redirect(`/rds/databases/${encodeURIComponent(id)}?kind=${eng.aurora ? "cluster" : "instance"}`);
}

/** Selected values are "instance|id" or "cluster|id". */
export async function dbAction(fd: FormData) {
  const op = String(fd.get("op"));
  const { rds } = await aws();
  for (const v of fd.getAll("selected").map(String)) {
    const [kind, id] = v.split("|");
    const inst = kind === "instance";
    await guard(`${op[0].toUpperCase()}${op.slice(1)} requested for ${id}.`, ["/rds/databases", `/rds/databases/${encodeURIComponent(id)}`], async () => {
      switch (op) {
        case "stop":
          return (inst ? rds.send(new StopDBInstanceCommand({ DBInstanceIdentifier: id })) : rds.send(new StopDBClusterCommand({ DBClusterIdentifier: id })));
        case "start":
          return (inst ? rds.send(new StartDBInstanceCommand({ DBInstanceIdentifier: id })) : rds.send(new StartDBClusterCommand({ DBClusterIdentifier: id })));
        case "reboot":
          if (!inst) throw new Error("Reboot the cluster's instances instead.");
          return rds.send(new RebootDBInstanceCommand({ DBInstanceIdentifier: id }));
        case "delete":
          if (inst) return rds.send(new DeleteDBInstanceCommand({ DBInstanceIdentifier: id, SkipFinalSnapshot: true, DeleteAutomatedBackups: true }));
          return rds.send(new DeleteDBClusterCommand({ DBClusterIdentifier: id, SkipFinalSnapshot: true }));
      }
    });
  }
  if (fd.get("from") === "detail" && op === "delete") redirect("/rds/databases");
}

export async function createSnapshot(fd: FormData) {
  const kind = String(fd.get("kind"));
  const id = String(fd.get("id"));
  const name = String(fd.get("snapshot") ?? "").trim();
  const { rds } = await aws();
  await guard(`Snapshot ${name} creation started.`, [`/rds/databases/${encodeURIComponent(id)}`, "/rds/snapshots"], () =>
    (kind === "cluster" ? rds.send(new CreateDBClusterSnapshotCommand({ DBClusterIdentifier: id, DBClusterSnapshotIdentifier: name })) : rds.send(new CreateDBSnapshotCommand({ DBInstanceIdentifier: id, DBSnapshotIdentifier: name }))),
  );
}

export async function deleteSnapshots(fd: FormData) {
  const { rds } = await aws();
  for (const v of fd.getAll("selected").map(String)) {
    const [kind, id] = v.split("|");
    await guard(`Snapshot ${id} deleted.`, ["/rds/snapshots"], () =>
      (kind === "cluster" ? rds.send(new DeleteDBClusterSnapshotCommand({ DBClusterSnapshotIdentifier: id })) : rds.send(new DeleteDBSnapshotCommand({ DBSnapshotIdentifier: id }))),
    );
  }
}
