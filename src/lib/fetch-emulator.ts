import "server-only";
import { request } from "node:https";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMULATOR_DIR } from "./emulator";

/** Fetch a URL served by the emulator (for example a Lambda code location) with this run's CA. */
export function fetchFromEmulator(url: string): Promise<Buffer> {
  const ca = readFileSync(join(EMULATOR_DIR, "ca.pem"), "utf8");
  const u = new URL(url);
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(u.hostname)) {
    return Promise.reject(new Error("Refusing to fetch a non-loopback URL."));
  }
  return new Promise((resolve, reject) => {
    const req = request(u, { ca, timeout: 5000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => (res.statusCode && res.statusCode < 300 ? resolve(Buffer.concat(chunks)) : reject(new Error(`HTTP ${res.statusCode}`))));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Timed out")));
    req.end();
  });
}
