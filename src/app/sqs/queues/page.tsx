import Link from "next/link";
import { Suspense } from "react";
import { GetQueueAttributesCommand, ListQueuesCommand } from "@aws-sdk/client-sqs";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createQueue, deleteQueues, purgeQueues } from "../actions";

export const metadata = { title: "Queues | SQS" };
const FORM = "queues-form";

type Q = { name: string; url: string; attrs: Record<string, string> };

async function Queues() {
  let queues: Q[] = [];
  let error: string | null = null;
  try {
    const { sqs } = await aws();
    const urls = (await sqs.send(new ListQueuesCommand({ MaxResults: 1000 }))).QueueUrls ?? [];
    queues = await Promise.all(
      urls.map(async (url) => ({
        url,
        name: url.split("/").pop()!,
        attrs: (await sqs.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ["All"] }))).Attributes ?? {},
      })),
    );
    queues.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={queues.length}
            info
            actions={
              <>
                <LinkButton href="/sqs/queues" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={purgeQueues} label="Purge" title="Purge queue" noun="queue" confirmWord="purge" confirmLabel="Purge" description="Purging deletes all messages in the queue. This can't be undone." />
                <ConfirmAction formId={FORM} action={deleteQueues} label="Delete" title="Delete queue" noun="queue" confirmWord="confirm" />
                <ModalButton label="Create queue" title="Create queue" variant="primary">
                  <form action={createQueue} className="space-y-4">
                    <FormField label="Type" description="You can't change the queue type after you create a queue.">
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2"><input type="radio" name="type" value="standard" defaultChecked className="accent-accent" /> Standard</label>
                        <label className="flex items-center gap-2"><input type="radio" name="type" value="fifo" className="accent-accent" /> FIFO</label>
                      </div>
                    </FormField>
                    <FormField label="Name" constraint="A queue name is case-sensitive and can have up to 80 characters. You can use alphanumeric characters, hyphens (-), and underscores (_). FIFO queue names end in .fifo (added automatically).">
                      <Input name="name" required maxLength={80} pattern="[A-Za-z0-9_\-]+(\.fifo)?" placeholder="Enter a name" autoFocus />
                    </FormField>
                    <FormField label="Visibility timeout (seconds)" constraint="Should be between 0 seconds and 12 hours.">
                      <Input name="visibility" type="number" min={0} max={43200} defaultValue={30} />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create queue</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Queues
          </Header>
          <TableFilter tableId="queues-table" placeholder="Search queues by prefix" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="queues-table"
        formId={FORM}
        selection="multi"
        rows={queues}
        rowKey={(q) => q.name}
        filterText={(q) => q.name}
        columns={[
          { header: "Name", cell: (q) => <Link className="underline-link" href={`/sqs/queues/${encodeURIComponent(q.name)}`}>{q.name}</Link> },
          { header: "Type", cell: (q) => (q.attrs.FifoQueue === "true" ? "FIFO" : "Standard") },
          { header: "Created", cell: (q) => formatDate(q.attrs.CreatedTimestamp) },
          { header: "Messages available", cell: (q) => q.attrs.ApproximateNumberOfMessages ?? "0" },
          { header: "Messages in flight", cell: (q) => q.attrs.ApproximateNumberOfMessagesNotVisible ?? "0" },
          { header: "Encryption", cell: (q) => (q.attrs.SqsManagedSseEnabled === "true" ? "Amazon SQS key (SSE-SQS)" : "-") },
        ]}
        empty={<EmptyState title="No queues" description="No queues to display." />}
      />
    </Container>
  );
}

export default function QueuesPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Queues</Header>}>Loading queues…</Container>}>
        <Queues />
      </Suspense>
    </Page>
  );
}
