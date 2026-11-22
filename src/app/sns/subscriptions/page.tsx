import { ListSubscriptionsCommand, type Subscription } from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { TableFilter } from "@/components/client/table-filter";
import { Container, EmptyState, ErrorAlert, Header, StatusIndicator } from "@/components/ui";
import { deleteSubscriptions } from "../actions";

export const metadata = { title: "Subscriptions | Amazon SNS" };

export default async function SubscriptionsPage() {
  const subs: Subscription[] = [];
  let error: string | null = null;
  try {
    const { sns } = await aws();
    let token: string | undefined;
    do {
      const r = await sns.send(new ListSubscriptionsCommand({ NextToken: token }));
      subs.push(...(r.Subscriptions ?? []));
      token = r.NextToken;
    } while (token);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            variant="h1"
            counter={subs.length}
            actions={<ConfirmAction formId="all-subs" action={deleteSubscriptions} label="Delete" title="Delete subscriptions" noun="subscription" confirmWord="delete me" />}
          >
            Subscriptions
          </Header>
        }
      >
        <form id="all-subs" />
        <TableFilter tableId="subs-table" placeholder="Search" />
        <Table
          id="subs-table"
          formId="all-subs"
          selection="multi"
          rows={subs}
          rowKey={(s) => s.SubscriptionArn ?? ""}
          filterText={(s) => `${s.SubscriptionArn} ${s.Endpoint} ${s.TopicArn} ${s.Protocol}`}
          columns={[
            {
              header: "ID",
              cell: (s) =>
                s.SubscriptionArn?.startsWith("arn:") ? (
                  <a className="font-mono text-[13px] text-accent hover:underline" href={`/sns/subscriptions/${encodeURIComponent(s.SubscriptionArn)}`}>{s.SubscriptionArn.split(":").pop()}</a>
                ) : (
                  s.SubscriptionArn
                ),
            },
            { header: "Endpoint", cell: (s) => <span className="break-all">{s.Endpoint}</span> },
            { header: "Status", cell: (s) => (s.SubscriptionArn === "PendingConfirmation" ? <StatusIndicator type="pending">Pending confirmation</StatusIndicator> : <StatusIndicator type="success">Confirmed</StatusIndicator>) },
            { header: "Protocol", cell: (s) => s.Protocol?.toUpperCase() },
            { header: "Topic", cell: (s) => <a className="text-accent hover:underline" href={`/sns/topics/${encodeURIComponent(s.TopicArn ?? "")}`}>{s.TopicArn?.split(":").pop()}</a> },
          ]}
          empty={<EmptyState title="No subscriptions" description="Create subscriptions from a topic's page." />}
        />
      </Container>
    </Page>
  );
}
