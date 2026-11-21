import "server-only";
import { request } from "node:https";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMULATOR_DIR, EMULATOR_ENDPOINT } from "./emulator";

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

/**
 * Call a deployed API Gateway stage in the emulator. The emulator routes by the
 * Host header <api-id>.execute-api.<region>.amazonaws.com, so the request goes to
 * the loopback endpoint with that Host header.
 */
export function invokeExecuteApi(opts: { apiId: string; region: string; method: string; path: string; body?: string; headers?: Record<string, string> }) {
  const ca = readFileSync(join(EMULATOR_DIR, "ca.pem"), "utf8");
  const endpoint = new URL(EMULATOR_ENDPOINT);
  return new Promise<{ status: number; headers: Record<string, string>; body: string; ms: number }>((resolve, reject) => {
    const started = Date.now();
    const req = request(
      {
        hostname: endpoint.hostname,
        port: endpoint.port,
        path: opts.path,
        method: opts.method,
        ca,
        servername: endpoint.hostname,
        timeout: 15000,
        headers: { ...(opts.headers ?? {}), host: `${opts.apiId}.execute-api.${opts.region}.amazonaws.com`, ...(opts.body ? { "content-type": "application/json", "content-length": Buffer.byteLength(opts.body) } : {}) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, String(v)])),
            body: Buffer.concat(chunks).toString("utf8"),
            ms: Date.now() - started,
          }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Timed out")));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
