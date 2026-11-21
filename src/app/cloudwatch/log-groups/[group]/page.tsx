import Link from "next/link";
import { DescribeLogStreamsCommand, GetLogEventsCommand, type LogStream, type OutputLogEvent } from "@aws-sdk/client-cloudwatch-logs";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Textarea, buttonClass } from "@/components/ui";
import { createLogStream, deleteLogStreams, putLogEvent } from "../../actions";

const FORM = "streams-form";

export default async function GroupPage({ params, searchParams }: PageProps<"/cloudwatch/log-groups/[group]">) {
  const group = decodeURIComponent((await params).group);
  const stream = (await searchParams).stream;
  const base = `/cloudwatch/log-groups/${encodeURIComponent(group)}`;
  const { logs } = await aws();

  if (typeof stream === "string") {
    let events: OutputLogEvent[] = [];
    let error: string | null = null;
    try {
      events = (await logs.send(new GetLogEventsCommand({ logGroupName: group, logStreamName: stream, startFromHead: true, limit: 1000 }))).events ?? [];
    } catch (e) {
      error = errorMessage(e);
    }
    return (
      <Page>
        <Header variant="h1">{stream}</Header>
        <p className="-mt-4 text-sm">
          <Link href={base} className="underline-link">{group}</Link>
        </p>
        {error && <ErrorAlert message={error} />}
        <Container
          noPadding
          header={
            <div className="space-y-3">
              <Header
                counter={events.length}
                actions={
                  <>
                    <LinkButton href={`${base}?stream=${encodeURIComponent(stream)}`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                    <ModalButton label="Put log events" title="Put log events" variant="primary">
                      <form action={putLogEvent} className="space-y-4">
                        <input type="hidden" name="group" value={group} />
                        <input type="hidden" name="stream" value={stream} />
                        <FormField label="Messages" description="One event per line.">
                          <Textarea name="message" rows={6} required />
                        </FormField>
                        <div className="flex justify-end"><button className={buttonClass("primary")}>Put events</button></div>
                      </form>
                    </ModalButton>
                  </>
                }
              >
                Log events
              </Header>
              <TableFilter tableId="events-table" placeholder="Filter events" />
            </div>
          }
        >
          <Table
            id="events-table"
            rows={events}
            rowKey={(e) => `${e.timestamp}-${e.ingestionTime}-${e.message?.slice(0, 40)}`}
            filterText={(e) => e.message ?? ""}
            columns={[
              { header: "Timestamp", width: "300px", cell: (e) => <span className="font-mono text-[13px]">{new Date(e.timestamp!).toISOString()}</span> },
              { header: "Message", cell: (e) => <pre className="font-mono text-[13px] whitespace-pre-wrap">{e.message}</pre> },
            ]}
            empty={<EmptyState title="No events" description="There are no older events to load." />}
          />
        </Container>
      </Page>
    );
  }

  let streams: LogStream[] = [];
  let error: string | null = null;
  try {
    streams = (await logs.send(new DescribeLogStreamsCommand({ logGroupName: group }))).logStreams ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Header variant="h1">{group}</Header>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={streams.length}
              actions={
                <>
                  <LinkButton href={base} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId={FORM} action={deleteLogStreams} extra={{ group }} label="Delete" title="Delete log stream(s)" noun="log stream" confirmWord="delete" />
                  <ModalButton label="Create log stream" title="Create log stream" variant="primary">
                    <form action={createLogStream} className="space-y-4">
                      <input type="hidden" name="group" value={group} />
                      <FormField label="Log stream name">
                        <Input name="name" required maxLength={512} autoFocus />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Log streams
            </Header>
            <TableFilter tableId="streams-table" placeholder="Filter log streams or try prefix search" />
          </div>
        }
      >
        <form id={FORM} />
        <Table
          id="streams-table"
          formId={FORM}
          selection="multi"
          rows={streams}
          rowKey={(s) => s.logStreamName!}
          filterText={(s) => s.logStreamName!}
          columns={[
            { header: "Log stream", cell: (s) => <Link className="underline-link" href={`${base}?stream=${encodeURIComponent(s.logStreamName!)}`}>{s.logStreamName}</Link> },
            { header: "Last event time", cell: (s) => formatDate(s.lastEventTimestamp) },
            { header: "Creation time", cell: (s) => formatDate(s.creationTime) },
          ]}
          empty={<EmptyState title="No log streams" />}
        />
      </Container>
    </Page>
  );
}
