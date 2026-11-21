import Link from "next/link";
import { Suspense } from "react";
import { DescribeStreamSummaryCommand, ListStreamsCommand, type StreamDescriptionSummary } from "@aws-sdk/client-kinesis";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createStream, deleteStreams } from "../actions";
import { streamStatus } from "../shared";

export const metadata = { title: "Data streams | Kinesis" };

async function Streams() {
  let streams: StreamDescriptionSummary[] = [];
  let error: string | null = null;
  try {
    const { kinesis } = await aws();
    const names = (await kinesis.send(new ListStreamsCommand({ Limit: 1000 }))).StreamNames ?? [];
    streams = await Promise.all(names.map(async (n) => (await kinesis.send(new DescribeStreamSummaryCommand({ StreamName: n }))).StreamDescriptionSummary!));
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={streams.length}
            info
            actions={
              <>
                <LinkButton href="/kinesis/streams" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId="streams-form" action={deleteStreams} label="Delete" title="Delete data stream" noun="data stream" confirmWord="delete" description="Deleting a data stream deletes all of its records and registered consumers." />
                <ModalButton label="Create data stream" title="Create data stream" variant="primary">
                  <form action={createStream} className="space-y-4">
                    <FormField label="Data stream name" constraint="Up to 128 characters: letters, numbers, ., - and _.">
                      <Input name="name" required maxLength={128} pattern="[A-Za-z0-9._\-]+" autoFocus />
                    </FormField>
                    <FormField label="Capacity mode">
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2"><input type="radio" name="mode" value="ON_DEMAND" defaultChecked className="accent-accent" /> On-demand</label>
                        <label className="flex items-center gap-2"><input type="radio" name="mode" value="PROVISIONED" className="accent-accent" /> Provisioned</label>
                      </div>
                    </FormField>
                    <FormField label="Provisioned shards"><Input name="shards" type="number" min={1} max={50} defaultValue={1} /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create data stream</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Data streams
          </Header>
          <TableFilter tableId="streams-table" placeholder="Filter data streams by name" />
        </div>
      }
    >
      <form id="streams-form" />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="streams-table"
        formId="streams-form"
        selection="multi"
        rows={streams}
        rowKey={(s) => s.StreamName!}
        filterText={(s) => s.StreamName!}
        columns={[
          { header: "Data stream name", cell: (s) => <Link className="underline-link" href={`/kinesis/streams/${encodeURIComponent(s.StreamName!)}`}>{s.StreamName}</Link> },
          { header: "Status", cell: (s) => streamStatus(s.StreamStatus) },
          { header: "Capacity mode", cell: (s) => (s.StreamModeDetails?.StreamMode === "ON_DEMAND" ? "On-demand" : "Provisioned") },
          { header: "Open shards", cell: (s) => s.OpenShardCount ?? 0, sortValue: (s) => s.OpenShardCount ?? 0 },
          { header: "Data retention", cell: (s) => `${s.RetentionPeriodHours ?? 24} hours` },
          { header: "Consumers", cell: (s) => s.ConsumerCount ?? 0 },
          { header: "Creation time", cell: (s) => formatDate(s.StreamCreationTimestamp) },
        ]}
        empty={<EmptyState title="No data streams" />}
      />
    </Container>
  );
}

export default function StreamsPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Data streams</Header>}>Loading…</Container>}>
        <Streams />
      </Suspense>
    </Page>
  );
}
