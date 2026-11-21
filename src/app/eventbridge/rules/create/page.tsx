import { ListEventBusesCommand } from "@aws-sdk/client-eventbridge";
import { aws } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, Select, Textarea, buttonClass } from "@/components/ui";
import { createRule } from "../../actions";

export const metadata = { title: "Create rule | EventBridge" };

const PATTERN = JSON.stringify({ source: ["com.mycompany.myapp"], "detail-type": ["myDetailType"] }, null, 2);

export default async function CreateRule({ searchParams }: PageProps<"/eventbridge/rules/create">) {
  const bus = String((await searchParams).bus ?? "default");
  const { events } = await aws();
  const buses = await events.send(new ListEventBusesCommand({ Limit: 100 })).then((r) => (r.EventBuses ?? []).map((b) => b.Name!)).catch(() => ["default"]);
  return (
    <Page>
      <Header variant="h1" info>Create rule</Header>
      <form action={createRule} className="flex max-w-[960px] flex-col gap-6">
        <Container header={<Header>Rule detail</Header>}>
          <div className="space-y-5">
            <FormField label="Name" constraint="Maximum of 64 characters consisting of numbers, lower/upper case letters, .,-,_.">
              <Input name="name" required maxLength={64} pattern="[A-Za-z0-9._\-]+" />
            </FormField>
            <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
            <FormField label="Event bus">
              <Select name="bus" defaultValue={bus}>{buses.map((b) => <option key={b}>{b}</option>)}</Select>
            </FormField>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked className="accent-accent" /> Enable the rule on the selected event bus</label>
          </div>
        </Container>
        <Container header={<Header description="Choose an event pattern, or a schedule (default bus only).">Rule type</Header>}>
          <div className="space-y-5">
            <label className="flex items-start gap-2"><input type="radio" name="kind" value="pattern" defaultChecked className="mt-1 accent-accent" /> <span><b>Rule with an event pattern</b></span></label>
            <FormField label="Event pattern"><Textarea name="pattern" rows={8} defaultValue={PATTERN} spellCheck={false} /></FormField>
            <label className="flex items-start gap-2"><input type="radio" name="kind" value="schedule" className="mt-1 accent-accent" /> <span><b>Schedule</b> <span className="text-sm text-muted">rate(5 minutes) or cron(0 12 * * ? *)</span></span></label>
            <FormField label="Schedule expression"><Input name="schedule" placeholder="rate(5 minutes)" /></FormField>
          </div>
        </Container>
        <Container header={<Header description="Add more targets from the rule's detail page.">Target</Header>}>
          <FormField label={<>Target ARN <i className="font-normal text-muted">- optional</i></>} description="Lambda function, SQS queue, SNS topic, Step Functions state machine, Kinesis stream, or event bus.">
            <Input name="target" placeholder="arn:aws:sqs:us-east-1:000000000000:my-queue" />
          </FormField>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href={`/eventbridge/rules?bus=${encodeURIComponent(bus)}`} variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Create rule</button>
        </div>
      </form>
    </Page>
  );
}
