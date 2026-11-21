import "server-only";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Agent } from "node:https";
import { connection } from "next/server";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";
import { IAMClient } from "@aws-sdk/client-iam";
import { STSClient } from "@aws-sdk/client-sts";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { EC2Client } from "@aws-sdk/client-ec2";

/**
 * Connection settings for the local AWS Emulator.
 *
 * The emulator writes a fresh CA certificate and fresh credentials into
 * ~/.aws/emulator/<port>/ every time it starts, so both are re-read on every
 * request instead of being cached for the life of the Next.js server.
 */
export const EMULATOR_PORT = process.env.EMULATOR_PORT ?? "9297";
export const EMULATOR_ENDPOINT =
  process.env.EMULATOR_ENDPOINT ?? `https://127.0.0.1:${EMULATOR_PORT}`;
export const EMULATOR_DIR =
  process.env.EMULATOR_DIR ?? join(homedir(), ".aws", "emulator", EMULATOR_PORT);
export const REGION = process.env.EMULATOR_REGION ?? "us-east-1";
export const EMULATOR_ACCOUNT = "000000000000";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** Refuse to talk to anything but a loopback emulator, so real AWS is never reached. */
function assertLoopback(endpoint: string) {
  const host = new URL(endpoint).hostname;
  if (!LOOPBACK.has(host) && process.env.CONSOLATION_ALLOW_NON_LOOPBACK !== "1") {
    throw new Error(
      `Refusing to use non-loopback endpoint ${endpoint}. Set CONSOLATION_ALLOW_NON_LOOPBACK=1 to override.`,
    );
  }
}

function parseIni(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const m = line.match(/^\[(.+)\]$/);
    if (m) {
      section = m[1].trim();
      out[section] ??= {};
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0 && section) out[section][line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

export class EmulatorUnavailableError extends Error {}

function loadRunFiles() {
  let ca: string;
  let creds: Record<string, string> | undefined;
  try {
    ca = readFileSync(join(EMULATOR_DIR, "ca.pem"), "utf8");
  } catch {
    throw new EmulatorUnavailableError(
      `No ca.pem in ${EMULATOR_DIR}. Is the aws-emulator container running with that folder mounted?`,
    );
  }
  try {
    creds = parseIni(readFileSync(join(EMULATOR_DIR, "emulator_credentials"), "utf8")).default;
  } catch {
    creds = undefined; // emulator started with `-a off`
  }
  return {
    ca,
    credentials: {
      accessKeyId: creds?.aws_access_key_id ?? "test",
      secretAccessKey: creds?.aws_secret_access_key ?? "test",
      ...(creds?.aws_session_token ? { sessionToken: creds.aws_session_token } : {}),
    },
  };
}

function baseConfig() {
  assertLoopback(EMULATOR_ENDPOINT);
  const { ca, credentials } = loadRunFiles();
  return {
    region: REGION,
    endpoint: EMULATOR_ENDPOINT,
    credentials,
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
      httpsAgent: new Agent({ ca, keepAlive: true }),
      connectionTimeout: 3000,
      requestTimeout: 30000,
    }),
  };
}

/**
 * Returns SDK clients bound to the emulator. Awaiting this also marks the
 * calling route as request-time only, so emulator state is never prerendered.
 */
export async function aws() {
  await connection();
  const cfg = baseConfig();
  return {
    s3: new S3Client({ ...cfg, forcePathStyle: true }),
    dynamodb: new DynamoDBClient(cfg),
    lambda: new LambdaClient(cfg),
    sqs: new SQSClient(cfg),
    sns: new SNSClient(cfg),
    iam: new IAMClient(cfg),
    sts: new STSClient(cfg),
    logs: new CloudWatchLogsClient(cfg),
    ec2: new EC2Client(cfg),
  };
}

export type Clients = Awaited<ReturnType<typeof aws>>;

/** Turns any SDK / network error into a short human message. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & { name?: string; $metadata?: { httpStatusCode?: number }; code?: string };
    if (e.code === "ECONNREFUSED" || /ECONNREFUSED/.test(e.message)) {
      return `Cannot reach the emulator at ${EMULATOR_ENDPOINT} (connection refused).`;
    }
    if (e.$metadata?.httpStatusCode === 501 || e.name === "NotImplemented") {
      return `${e.name}: this operation is not implemented by the installed emulator build.`;
    }
    return e.name && e.name !== "Error" ? `${e.name}: ${e.message}` : e.message;
  }
  return String(err);
}
