import { GetObjectCommand } from "@aws-sdk/client-s3";
import { aws, errorMessage } from "@/lib/emulator";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") ?? "";
  const key = url.searchParams.get("key") ?? "";
  const inline = url.searchParams.get("inline") === "1";
  try {
    const { s3 } = await aws();
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = obj.Body?.transformToWebStream();
    const name = key.split("/").pop() || "download";
    return new Response(body ?? null, {
      headers: {
        "content-type": inline ? (obj.ContentType ?? "application/octet-stream") : "application/octet-stream",
        "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        ...(obj.ContentLength !== undefined ? { "content-length": String(obj.ContentLength) } : {}),
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox",
      },
    });
  } catch (e) {
    return new Response(errorMessage(e), { status: 502 });
  }
}
