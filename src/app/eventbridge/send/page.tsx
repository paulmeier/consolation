import { ListEventBusesCommand } from "@aws-sdk/client-eventbridge";
import { aws } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Container, Header } from "@/components/ui";
import { SendEventForm } from "../client-forms";

export const metadata = { title: "Send events | EventBridge" };

export default async function SendPage() {
  const { events } = await aws();
  const buses = await events.send(new ListEventBusesCommand({ Limit: 100 })).then((r) => (r.EventBuses ?? []).map((b) => b.Name!)).catch(() => ["default"]);
  return (
    <Page>
      <Header variant="h1" description="Send a custom event to an event bus (PutEvents). Rules on that bus route it to their targets.">Send events</Header>
      <Container className="max-w-[960px]">
        <SendEventForm buses={buses} />
      </Container>
    </Page>
  );
}
