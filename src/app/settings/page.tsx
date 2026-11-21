import { Suspense } from "react";
import { EMULATOR_DIR, EMULATOR_ENDPOINT, EMULATOR_PORT, REGION } from "@/lib/emulator";
import { checkHealth } from "@/lib/health";
import { Code, Container, Header, KeyValue, StatusIndicator } from "@/components/ui";

export const metadata = { title: "Emulator settings" };

async function Health() {
  const h = await checkHealth();
  return h.ok ? <StatusIndicator type="success">Healthy ({h.detail})</StatusIndicator> : <StatusIndicator type="error">{h.detail}</StatusIndicator>;
}

export default function Settings() {
  return (
    <main className="mx-auto max-w-[1080px] px-4 py-6 md:px-10">
      <div className="flex flex-col gap-6">
        <Header variant="h1" description="Consolation reads these from environment variables when the Next.js server starts.">
          Emulator settings
        </Header>
        <Container header={<Header>Connection</Header>}>
          <KeyValue
            columns={2}
            items={[
              { label: "Health", value: <Suspense fallback="Checking…"><Health /></Suspense> },
              { label: "Endpoint (EMULATOR_ENDPOINT)", value: <Code>{EMULATOR_ENDPOINT}</Code> },
              { label: "Port (EMULATOR_PORT)", value: <Code>{EMULATOR_PORT}</Code> },
              { label: "Region (EMULATOR_REGION)", value: <Code>{REGION}</Code> },
              { label: "Run files (EMULATOR_DIR)", value: <Code>{EMULATOR_DIR}</Code> },
              { label: "Account", value: <Code>000000000000</Code> },
            ]}
          />
        </Container>
        <Container header={<Header>How Consolation connects</Header>}>
          <ul className="list-disc space-y-2 pl-5">
            <li>Every request is signed with the credentials the emulator wrote to <Code>emulator_credentials</Code> for this run, and TLS is verified against this run&apos;s <Code>ca.pem</Code>. Both are re-read per request, so restarting the emulator needs no restart here.</li>
            <li>Only loopback endpoints are allowed, so Consolation can never send requests to real AWS.</li>
            <li>Emulator state is in memory: restarting the container clears every resource.</li>
          </ul>
        </Container>
      </div>
    </main>
  );
}
