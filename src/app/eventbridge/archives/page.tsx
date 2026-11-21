import { ListArchivesCommand, ListEventBusesCommand, ListReplaysCommand, type Archive, type Replay } from "@aws-sdk/client-eventbridge";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, Textarea, buttonClass } from "@/components/ui";
import { createArchive, deleteArchives, startReplay } from "../actions";

export const metadata = { title: "Archives and replays | EventBridge" };

export default async function ArchivesPage() {
  let archives: Archive[] = [];
  let replays: Replay[] = [];
  let buses: { name: string; arn: string }[] = [];
  let error: string | null = null;
  try {
    const { events } = await aws();
    [archives, replays, buses] = await Promise.all([
      events.send(new ListArchivesCommand({ Limit: 100 })).then((r) => r.Archives ?? []),
      events.send(new ListReplaysCommand({ Limit: 100 })).then((r) => r.Replays ?? []).catch(() => []),
      events.send(new ListEventBusesCommand({ Limit: 100 })).then((r) => (r.EventBuses ?? []).map((b) => ({ name: b.Name!, arn: b.Arn! }))),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600_000);
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return (
    <Page>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            counter={archives.length}
            info
            description="Archives store events from an event bus so you can replay them later."
            actions={
              <>
                <ConfirmAction formId="arch-form" action={deleteArchives} label="Delete" title="Delete archive" noun="archive" confirmWord="delete" />
                <ModalButton label="Start replay" title="Start new replay">
                  <form action={startReplay} className="space-y-4">
                    <FormField label="Name"><Input name="name" required pattern="[A-Za-z0-9._\-]+" /></FormField>
                    <FormField label="Source archive"><Select name="archiveArn" required>{archives.map((a) => <option key={a.ArchiveName} value={`arn:aws:events:us-east-1:000000000000:archive/${a.ArchiveName}`}>{a.ArchiveName}</option>)}</Select></FormField>
                    <FormField label="Destination event bus"><Select name="busArn">{buses.map((b) => <option key={b.arn} value={b.arn}>{b.name}</option>)}</Select></FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Start time"><Input name="start" type="datetime-local" defaultValue={local(hourAgo)} /></FormField>
                      <FormField label="End time"><Input name="end" type="datetime-local" defaultValue={local(now)} /></FormField>
                    </div>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Start replay</button></div>
                  </form>
                </ModalButton>
                <ModalButton label="Create archive" title="Create archive" variant="primary">
                  <form action={createArchive} className="space-y-4">
                    <FormField label="Name"><Input name="name" required maxLength={48} pattern="[A-Za-z0-9._\-]+" autoFocus /></FormField>
                    <FormField label="Source"><Select name="source">{buses.map((b) => <option key={b.arn} value={b.arn}>{b.name}</option>)}</Select></FormField>
                    <FormField label="Retention period (days)" description="0 means indefinitely."><Input name="retention" type="number" min={0} defaultValue={0} /></FormField>
                    <FormField label={<>Event pattern <i className="font-normal text-muted">- optional</i></>}><Textarea name="pattern" rows={5} /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create archive</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Archives
          </Header>
        }
      >
        <form id="arch-form" />
        <Table
          formId="arch-form"
          selection="multi"
          rows={archives}
          rowKey={(a) => a.ArchiveName!}
          columns={[
            { header: "Name", cell: (a) => a.ArchiveName },
            { header: "State", cell: (a) => a.State },
            { header: "Source", cell: (a) => <span className="font-mono text-xs">{a.EventSourceArn?.split("/").pop()}</span> },
            { header: "Events", cell: (a) => a.EventCount ?? 0, sortValue: (a) => a.EventCount ?? 0 },
            { header: "Retention", cell: (a) => (a.RetentionDays ? `${a.RetentionDays} days` : "Indefinite") },
            { header: "Created", cell: (a) => formatDate(a.CreationTime) },
          ]}
          empty={<EmptyState title="No archives" />}
        />
      </Container>
      <Container noPadding header={<Header counter={replays.length}>Replays</Header>}>
        <Table
          rows={replays}
          rowKey={(r) => r.ReplayName!}
          columns={[
            { header: "Name", cell: (r) => r.ReplayName },
            { header: "State", cell: (r) => r.State },
            { header: "Archive", cell: (r) => r.EventSourceArn?.split("/").pop() },
            { header: "Start time", cell: (r) => formatDate(r.ReplayStartTime) },
            { header: "End time", cell: (r) => formatDate(r.ReplayEndTime) },
          ]}
          empty={<EmptyState title="No replays" />}
        />
      </Container>
    </Page>
  );
}
