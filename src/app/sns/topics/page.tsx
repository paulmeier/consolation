import Link from "next/link";
import { Suspense } from "react";
import { ListTopicsCommand } from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createTopic, deleteTopics } from "../actions";

export const metadata = { title: "Topics | SNS" };
const FORM = "topics-form";

async function Topics() {
  let arns: string[] = [];
  let error: string | null = null;
  try {
    const { sns } = await aws();
    let token: string | undefined;
    do {
      const res = await sns.send(new ListTopicsCommand({ NextToken: token }));
      arns.push(...(res.Topics ?? []).map((t) => t.TopicArn!));
      token = res.NextToken;
    } while (token);
    arns = arns.sort();
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={arns.length}
            info
            actions={
              <>
                <LinkButton href="/sns/topics" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteTopics} label="Delete" title="Delete topic" noun="topic" confirmWord="delete me" description="Deleting a topic also deletes all of its subscriptions." />
                <ModalButton label="Create topic" title="Create topic" variant="primary">
                  <form action={createTopic} className="space-y-4">
                    <FormField label="Type" description="Topic type can't be modified after topic is created.">
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2"><input type="radio" name="type" value="standard" defaultChecked className="accent-accent" /> Standard</label>
                        <label className="flex items-center gap-2"><input type="radio" name="type" value="fifo" className="accent-accent" /> FIFO</label>
                      </div>
                    </FormField>
                    <FormField label="Name" constraint="Maximum 256 characters. Can include alphanumeric characters, hyphens (-) and underscores (_).">
                      <Input name="name" required maxLength={256} pattern="[A-Za-z0-9_\-]+(\.fifo)?" placeholder="MyTopic" autoFocus />
                    </FormField>
                    <FormField label={<>Display name <i className="font-normal text-muted">- optional</i></>}>
                      <Input name="display" maxLength={100} placeholder="My Topic" />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create topic</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Topics
          </Header>
          <TableFilter tableId="topics-table" placeholder="Search" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="topics-table"
        formId={FORM}
        selection="single"
        rows={arns}
        rowKey={(a) => a}
        filterText={(a) => a}
        columns={[
          { header: "Name", cell: (a) => <Link className="underline-link" href={`/sns/topics/${encodeURIComponent(a)}`}>{a.split(":").pop()}</Link> },
          { header: "Type", cell: (a) => (a.endsWith(".fifo") ? "FIFO" : "Standard") },
          { header: "ARN", cell: (a) => <span className="font-mono text-[13px]">{a}</span> },
        ]}
        empty={<EmptyState title="No topics" description="To get started, create a topic." />}
      />
    </Container>
  );
}

export default function TopicsPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Topics</Header>}>Loading topics…</Container>}>
        <Topics />
      </Suspense>
    </Page>
  );
}
