import { StartLiveTailCommand } from "@aws-sdk/client-cloudwatch-logs";
import { aws, errorMessage, REGION, EMULATOR_ACCOUNT } from "@/lib/emulator";

/**
 * Server-Sent Events relay for CloudWatch Logs Live Tail. The browser opens an
 * EventSource; this handler holds the StartLiveTail event stream and forwards
 * each batch of log events until the browser disconnects. Same-origin only.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const groups = url.searchParams.getAll("group").filter(Boolean);
  if (!groups.length) return new Response("At least one group is required.", { status: 400 });
  const pattern = url.searchParams.get("pattern") ?? "";
  const streams = url.searchParams.get("streams") ?? "";
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    // Don't await the relay in start(): a stream isn't readable until start() settles.
    start(controller) {
      void relay(controller);
    },
    cancel() {
      abort.abort();
    },
  });

  async function relay(controller: ReadableStreamDefaultController<Uint8Array>) {
    const send = (event: string, data: unknown) => {
      try {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      } catch {
        abort.abort();
      }
    };
    try {
      const { logs } = await aws();
      const res = await logs.send(
        new StartLiveTailCommand({
          logGroupIdentifiers: groups.map((g) => (g.startsWith("arn:") ? g : `arn:aws:logs:${REGION}:${EMULATOR_ACCOUNT}:log-group:${g}`)),
          ...(pattern ? { logEventFilterPattern: pattern } : {}),
          ...(streams
            ? {
                logStreamNamePrefixes: streams
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : {}),
        }),
        { abortSignal: abort.signal },
      );
      for await (const ev of res.responseStream ?? []) {
        if (abort.signal.aborted) break;
        if (ev.sessionStart) send("start", { sessionId: ev.sessionStart.sessionId });
        if (ev.sessionUpdate) {
          send("events", {
            sampled: ev.sessionUpdate.sessionMetadata?.sampled ?? false,
            events: (ev.sessionUpdate.sessionResults ?? []).map((r) => ({
              timestamp: r.timestamp,
              group: r.logGroupIdentifier?.split(":log-group:").pop(),
              stream: r.logStreamName,
              message: r.message,
            })),
          });
        }
        if (ev.SessionTimeoutException) send("end", { reason: "Session timed out." });
        if (ev.SessionStreamingException) send("failure", { message: ev.SessionStreamingException.message });
      }
      send("end", { reason: "Session ended." });
    } catch (e) {
      if (!abort.signal.aborted) send("failure", { message: errorMessage(e) });
    } finally {
      try {
        controller.close();
      } catch {}
    }
  }
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
