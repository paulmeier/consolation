import Link from "next/link";
import { Suspense } from "react";
import { ListSecretsCommand, type SecretListEntry } from "@aws-sdk/client-secrets-manager";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, Input, LinkButton, RefreshIcon, StatusIndicator } from "@/components/ui";
import { deleteSecrets } from "../actions";

export const metadata = { title: "Secrets | Secrets Manager" };
const FORM = "secrets-form";

async function Secrets() {
  const list: SecretListEntry[] = [];
  let error: string | null = null;
  try {
    const { secrets } = await aws();
    let token: string | undefined;
    do {
      const r = await secrets.send(new ListSecretsCommand({ NextToken: token, IncludePlannedDeletion: true, MaxResults: 100 }));
      list.push(...(r.SecretList ?? []));
      token = r.NextToken;
    } while (token);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={list.length}
            info
            actions={
              <>
                <LinkButton href="/secretsmanager/secrets" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction
                  formId={FORM}
                  action={deleteSecrets}
                  label="Delete"
                  title="Delete secret"
                  noun="secret"
                  confirmWord="delete"
                  confirmLabel="Schedule deletion"
                  description="Secrets Manager schedules the deletion after a waiting period. You can cancel the deletion during the waiting period."
                  fields={
                    <div className="space-y-2">
                      <label className="block text-sm font-bold">Waiting period (in days)</label>
                      <Input name="window" type="number" min={7} max={30} defaultValue={30} />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="force" className="accent-accent" /> Delete immediately without a recovery window
                      </label>
                    </div>
                  }
                />
                <LinkButton href="/secretsmanager/secrets/create" variant="primary">Store a new secret</LinkButton>
              </>
            }
          >
            Secrets
          </Header>
          <TableFilter tableId="secrets-table" placeholder="Filter secrets by name, description, tag key or value" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="secrets-table"
        formId={FORM}
        selection="multi"
        rows={list}
        rowKey={(s) => s.Name!}
        filterText={(s) => `${s.Name} ${s.Description ?? ""} ${(s.Tags ?? []).map((t) => `${t.Key} ${t.Value}`).join(" ")}`}
        columns={[
          { header: "Secret name", cell: (s) => <Link className="underline-link" href={`/secretsmanager/secrets/${encodeURIComponent(s.Name!)}`}>{s.Name}</Link> },
          { header: "Description", cell: (s) => s.Description || "-" },
          { header: "Status", cell: (s) => (s.DeletedDate ? <StatusIndicator type="warning">Scheduled for deletion</StatusIndicator> : <StatusIndicator type="success">Available</StatusIndicator>) },
          { header: "Rotation", cell: (s) => (s.RotationEnabled ? "Enabled" : "Disabled") },
          { header: "Last retrieved (UTC)", cell: (s) => formatDate(s.LastAccessedDate) },
          { header: "Last modified", cell: (s) => formatDate(s.LastChangedDate) },
        ]}
        empty={<EmptyState title="No secrets" description="You don't have any secrets." action={<LinkButton href="/secretsmanager/secrets/create">Store a new secret</LinkButton>} />}
      />
    </Container>
  );
}

export default function SecretsPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Secrets</Header>}>Loading secrets…</Container>}>
        <Secrets />
      </Suspense>
    </Page>
  );
}
