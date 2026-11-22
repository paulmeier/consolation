import fs from "node:fs";
import os from "node:os";
import https from "node:https";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { CompleteLayerUploadCommand, CreateRepositoryCommand, DeleteRepositoryCommand, ECRClient, InitiateLayerUploadCommand, PutImageCommand, UploadLayerPartCommand } from "@aws-sdk/client-ecr";
import { NodeHttpHandler } from "@smithy/node-http-handler";

/** SDK config for test setup that the UI can't do (for example pushing image layers). */
function config() {
  const port = process.env.EMULATOR_PORT ?? "9297";
  const dir = process.env.EMULATOR_DIR ?? `${os.homedir()}/.aws/emulator/${port}`;
  const creds = Object.fromEntries(
    fs
      .readFileSync(`${dir}/emulator_credentials`, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => l.split("=").map((s) => s.trim())),
  );
  return {
    region: process.env.EMULATOR_REGION ?? "us-east-1",
    endpoint: `https://127.0.0.1:${port}`,
    credentials: { accessKeyId: creds.aws_access_key_id, secretAccessKey: creds.aws_secret_access_key },
    requestHandler: new NodeHttpHandler({ httpsAgent: new https.Agent({ ca: fs.readFileSync(`${dir}/ca.pem`) }) }),
  };
}

const sha = (b: Buffer) => "sha256:" + crypto.createHash("sha256").update(b).digest("hex");

/** Create an ECR repository holding a minimal one-layer image tagged latest; returns its URI. */
export async function pushTestImage(repo: string): Promise<string> {
  const ecr = new ECRClient(config());
  const r = await ecr.send(new CreateRepositoryCommand({ repositoryName: repo }));
  const blob = async (buf: Buffer) => {
    const { uploadId } = await ecr.send(new InitiateLayerUploadCommand({ repositoryName: repo }));
    await ecr.send(new UploadLayerPartCommand({ repositoryName: repo, uploadId, partFirstByte: 0, partLastByte: buf.length - 1, layerPartBlob: buf }));
    await ecr.send(new CompleteLayerUploadCommand({ repositoryName: repo, uploadId, layerDigests: [sha(buf)] }));
    return sha(buf);
  };
  const tar = Buffer.alloc(1024); // an empty tar archive
  const layer = zlib.gzipSync(tar);
  const layerDigest = await blob(layer);
  const cfg = Buffer.from(JSON.stringify({ architecture: "amd64", os: "linux", config: { Cmd: ["app.handler"] }, rootfs: { type: "layers", diff_ids: [sha(tar)] } }));
  const cfgDigest = await blob(cfg);
  const manifest = {
    schemaVersion: 2,
    mediaType: "application/vnd.docker.distribution.manifest.v2+json",
    config: { mediaType: "application/vnd.docker.container.image.v1+json", size: cfg.length, digest: cfgDigest },
    layers: [{ mediaType: "application/vnd.docker.image.rootfs.diff.tar.gzip", size: layer.length, digest: layerDigest }],
  };
  await ecr.send(new PutImageCommand({ repositoryName: repo, imageManifest: JSON.stringify(manifest), imageTag: "latest" }));
  return `${r.repository!.repositoryUri}:latest`;
}

export async function deleteTestRepository(repo: string) {
  await new ECRClient(config()).send(new DeleteRepositoryCommand({ repositoryName: repo, force: true }));
}
