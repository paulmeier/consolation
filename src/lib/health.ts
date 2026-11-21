import "server-only";
import { request } from "node:https";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connection } from "next/server";
import { EMULATOR_DIR, EMULATOR_ENDPOINT } from "./emulator";

/** GET /__admin/health on the emulator, trusting this run's CA. */
export async function checkHealth(): Promise<{ ok: boolean; detail: string }> {
  await connection();
  let ca: string;
  try {
    ca = readFileSync(join(EMULATOR_DIR, "ca.pem"), "utf8");
  } catch {
    return { ok: false, detail: `No ca.pem in ${EMULATOR_DIR}` };
  }
  return new Promise((resolve) => {
    const req = request(new URL("/__admin/health", EMULATOR_ENDPOINT), { ca, timeout: 1500 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ ok: res.statusCode === 200, detail: body.trim() || `HTTP ${res.statusCode}` }));
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, detail: "Timed out" });
    });
    req.on("error", (e) => resolve({ ok: false, detail: e.message }));
    req.end();
  });
}
