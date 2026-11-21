import { DescribeStreamSummaryCommand, ListShardsCommand, ListStreamConsumersCommand } from "@aws-sdk/client-kinesis";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { deleteStreams, deregisterConsumers, mergeShards, registerConsumer, scaleStream, setRetention, splitShard } from "../../actions";
import { DataViewer } from "../../data-viewer";
import { streamStatus } from "../../shared";

export default async function StreamPage({ params, searchParams }: PageProps<"/kinesis/streams/[name]">) {
  const name = decodeURIComponent((await params).name);
  const tab = String((await searchParams).tab ?? "viewer");
  const { kinesis } = await aws();
  let data;
  try {
    const summary = await kinesis.send(new DescribeStreamSummaryCommand({ StreamName: name }));
    data = await Promise.all([
      summary,
      kinesis.send(new ListShardsCommand({ StreamName: name })).catch(() => ({ Shards: [] })),
      kinesis.send(new ListStreamConsumersCommand({ StreamARN: summary.StreamDescriptionSummary!.StreamARN })).catch(() => ({ Consumers: [] })),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [sum, shards, consumers] = data;
  const s = sum.StreamDescriptionSummary!;
  const open = (shards.Shards ?? []).filter((x) => !x.SequenceNumberRange?.EndingSequenceNumber);
  const base = `/kinesis/streams/${encodeURIComponent(name)}`;
  const hidden = <input type="hidden" name="name" value={name} />;
  const provisioned = s.StreamModeDetails?.StreamMode !== "ON_DEMAND";
  return (
    <Page wide>
      <Header variant="h1" actions={<><LinkButton href={`${base}?tab=${tab}`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton><ConfirmAction values={[name]} extra={{ from: "detail" }} action={deleteStreams} label="Delete" title="Delete data stream" noun="data stream" confirmWord="delete" /></>}>
        {name}
      </Header>
      <Container header={<Header>Data stream summary</Header>}>
        <KeyValue
          columns={4}
          items={[
            { label: "Status", value: streamStatus(s.StreamStatus) },
            { label: "Capacity mode", value: provisioned ? "Provisioned" : "On-demand" },
            { label: "Open shards", value: s.OpenShardCount ?? open.length },
            { label: "Data retention period", value: `${s.RetentionPeriodHours} hours` },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{s.StreamARN}</span> },
            { label: "Creation time", value: formatDate(s.StreamCreationTimestamp) },
            { label: "Encryption", value: s.EncryptionType === "KMS" ? `KMS (${s.KeyId})` : "Disabled" },
            { label: "Consumers (enhanced fan-out)", value: s.ConsumerCount ?? consumers.Consumers?.length ?? 0 },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "viewer", label: "Data viewer" }, { id: "shards", label: "Shards" }, { id: "consumers", label: "Enhanced fan-out" }, { id: "config", label: "Configuration" }]} />
      {tab === "viewer" && (
        <Container header={<Header description="Put test records and read them back from a shard.">Data viewer</Header>}>
          <DataViewer name={name} shards={open.map((x) => x.ShardId!)} />
        </Container>
      )}
      {tab === "shards" && (
        <Container
          noPadding
          header={
            <Header
              counter={shards.Shards?.length ?? 0}
              description="Select two adjacent open shards to merge them."
              actions={<ConfirmAction formId="shards-form" action={mergeShards} extra={{ name }} label="Merge shards" title="Merge shards" noun="shard" confirmWord="merge" confirmLabel="Merge" />}
            >
              Shards
            </Header>
          }
        >
          <form id="shards-form" />
          <Table
            formId="shards-form"
            selection="multi"
            rows={shards.Shards ?? []}
            rowKey={(x) => x.ShardId!}
            columns={[
              { header: "Shard ID", cell: (x) => <span className="font-mono text-[13px]">{x.ShardId}</span> },
              { header: "Status", cell: (x) => (x.SequenceNumberRange?.EndingSequenceNumber ? "Closed" : "Open") },
              { header: "Parent", cell: (x) => x.ParentShardId ?? "-" },
              { header: "Hash key range", cell: (x) => <span className="font-mono text-xs break-all">{x.HashKeyRange?.StartingHashKey} – {x.HashKeyRange?.EndingHashKey}</span> },
              { header: "", sortable: false, cell: (x) => (!x.SequenceNumberRange?.EndingSequenceNumber && provisioned ? <form action={splitShard}>{hidden}<input type="hidden" name="shard" value={x.ShardId} /><button className={buttonClass("normal")}>Split</button></form> : null) },
            ]}
            empty={<EmptyState title="No shards" />}
          />
        </Container>
      )}
      {tab === "consumers" && (
        <Container
          noPadding
          header={
            <Header
              counter={consumers.Consumers?.length ?? 0}
              actions={
                <>
                  <ConfirmAction formId="cons-form" action={deregisterConsumers} extra={{ name }} label="Deregister" title="Deregister consumer" noun="consumer" confirmWord="deregister" confirmLabel="Deregister" />
                  <ModalButton label="Register consumer" title="Register consumer" variant="primary">
                    <form action={registerConsumer} className="space-y-4">
                      {hidden}
                      <input type="hidden" name="arn" value={s.StreamARN} />
                      <FormField label="Consumer name"><Input name="consumer" required pattern="[A-Za-z0-9._\-]+" autoFocus /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Register</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Enhanced fan-out consumers
            </Header>
          }
        >
          <form id="cons-form" />
          <Table
            formId="cons-form"
            selection="multi"
            rows={consumers.Consumers ?? []}
            rowKey={(c) => c.ConsumerARN!}
            columns={[
              { header: "Consumer name", cell: (c) => c.ConsumerName },
              { header: "Status", cell: (c) => c.ConsumerStatus },
              { header: "Registered", cell: (c) => formatDate(c.ConsumerCreationTimestamp) },
            ]}
            empty={<EmptyState title="No consumers" />}
          />
        </Container>
      )}
      {tab === "config" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Container header={<Header>Data retention</Header>}>
            <form action={setRetention} className="space-y-4">
              {hidden}
              <input type="hidden" name="current" value={s.RetentionPeriodHours} />
              <FormField label="Retention period (hours)" constraint="Between 24 and 8760 hours."><Input name="hours" type="number" min={24} max={8760} defaultValue={s.RetentionPeriodHours} /></FormField>
              <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
            </form>
          </Container>
          {provisioned && (
            <Container header={<Header>Scaling</Header>}>
              <form action={scaleStream} className="space-y-4">
                {hidden}
                <FormField label="Target shard count" constraint="Uniform scaling; at most double or half the current count."><Input name="count" type="number" min={1} defaultValue={open.length} /></FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
              </form>
            </Container>
          )}
        </div>
      )}
    </Page>
  );
}
