import { Readable } from "node:stream";
import { Upload } from "@aws-sdk/lib-storage";
import { aws, errorMessage } from "@/lib/emulator";

/**
 * Streams a browser upload straight to S3 with multipart upload, so files larger
 * than the Server Action body limit work. Same-origin requests only.
 */
export async function PUT(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return new Response("Cross-origin uploads are not allowed.", { status: 403 });
  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") ?? "";
  const key = url.searchParams.get("key") ?? "";
  if (!bucket || !key || !req.body) return new Response("bucket, key and a body are required.", { status: 400 });
  try {
    const { s3 } = await aws();
    const upload = new Upload({
      client: s3,
      params: { Bucket: bucket, Key: key, Body: Readable.fromWeb(req.body as never), ContentType: req.headers.get("content-type") || "application/octet-stream" },
      partSize: 8 * 1024 * 1024,
      queueSize: 4,
    });
    const r = await upload.done();
    return Response.json({ ok: true, etag: r.ETag });
  } catch (e) {
    return new Response(errorMessage(e), { status: 502 });
  }
}
