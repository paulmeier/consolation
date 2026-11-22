import { DescribeLogGroupsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Container, ErrorAlert, Header } from "@/components/ui";
import { LiveTail } from "./tail";

export const metadata = { title: "Live tail | CloudWatch" };

export default async function LiveTailPage({ searchParams }: PageProps<"/cloudwatch/live-tail">) {
  const sp = await searchParams;
  let groups: string[] = [];
  let error: string | null = null;
  try {
    const { logs } = await aws();
    groups = ((await logs.send(new DescribeLogGroupsCommand({ limit: 50 }))).logGroups ?? []).map((g) => g.logGroupName!);
  } catch (e) {
    error = errorMessage(e);
  }
  const initial = typeof sp.group === "string" ? [sp.group] : groups.slice(0, 1);
  return (
    <Page wide>
      <Header variant="h1" description="Stream new log events as they are ingested (StartLiveTail). Only events that arrive after you start are shown.">
        Live tail
      </Header>
      {error && <ErrorAlert message={error} />}
      <Container>
        <LiveTail groups={groups} initial={initial} />
      </Container>
    </Page>
  );
}
