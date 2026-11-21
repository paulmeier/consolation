import Link from "next/link";
import { Suspense } from "react";
import { DescribeKeyCommand, ListAliasesCommand, ListKeysCommand, type AliasListEntry, type KeyMetadata, type ListAliasesCommandOutput, type ListKeysCommandOutput } from "@aws-sdk/client-kms";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, Input, LinkButton, RefreshIcon } from "@/components/ui";
import { scheduleDeletion } from "../actions";
import { keyState } from "../shared";

export const metadata = { title: "Keys | KMS" };
const FORM = "keys-form";

async function Keys({ awsManaged }: { awsManaged: boolean }) {
  let keys: (KeyMetadata & { aliases: string[] })[] = [];
  let error: string | null = null;
  try {
    const { kms } = await aws();
    const ids: string[] = [];
    let marker: string | undefined;
    do {
      const r: ListKeysCommandOutput = await kms.send(new ListKeysCommand({ Marker: marker, Limit: 100 }));
      ids.push(...(r.Keys ?? []).map((k) => k.KeyId!));
      marker = r.Truncated ? r.NextMarker : undefined;
    } while (marker);
    const aliases: AliasListEntry[] = [];
    marker = undefined;
    do {
      const r: ListAliasesCommandOutput = await kms.send(new ListAliasesCommand({ Marker: marker, Limit: 100 }));
      aliases.push(...(r.Aliases ?? []));
      marker = r.Truncated ? r.NextMarker : undefined;
    } while (marker);
    const metas = await Promise.all(ids.map(async (id) => (await kms.send(new DescribeKeyCommand({ KeyId: id }))).KeyMetadata!));
    keys = metas
      .filter((m) => (m.KeyManager === "AWS") === awsManaged)
      .map((m) => ({ ...m, aliases: aliases.filter((a) => a.TargetKeyId === m.KeyId).map((a) => a.AliasName!) }));
  } catch (e) {
    error = errorMessage(e);
  }
  const title = awsManaged ? "AWS managed keys" : "Customer managed keys";
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={keys.length}
            info
            actions={
              !awsManaged && (
                <>
                  <LinkButton href="/kms/keys" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction
                    formId={FORM}
                    action={scheduleDeletion}
                    label="Schedule key deletion"
                    title="Schedule key deletion"
                    noun="key"
                    confirmWord="confirm"
                    confirmLabel="Schedule deletion"
                    description="After the waiting period ends, the key and all data encrypted under it become unrecoverable. You can cancel the deletion during the waiting period."
                    fields={
                      <div className="space-y-1">
                        <label className="block text-sm font-bold">Waiting period (in days)</label>
                        <Input name="window" type="number" min={7} max={30} defaultValue={30} />
                      </div>
                    }
                  />
                  <LinkButton href="/kms/keys/create" variant="primary">Create key</LinkButton>
                </>
              )
            }
          >
            {title}
          </Header>
          <TableFilter tableId="keys-table" placeholder="Filter keys by properties or tags" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="keys-table"
        formId={FORM}
        selection={awsManaged ? undefined : "multi"}
        rows={keys}
        rowKey={(k) => k.KeyId!}
        filterText={(k) => `${k.aliases.join(" ")} ${k.KeyId} ${k.KeySpec} ${k.KeyUsage} ${k.Description ?? ""}`}
        columns={[
          { header: "Aliases", cell: (k) => (k.aliases.length ? k.aliases.join(", ") : "-") },
          { header: "Key ID", cell: (k) => <Link className="underline-link font-mono text-[13px]" href={`/kms/keys/${k.KeyId}`}>{k.KeyId}</Link> },
          { header: "Status", cell: (k) => keyState(k.KeyState) },
          { header: "Key spec", cell: (k) => k.KeySpec },
          { header: "Key usage", cell: (k) => k.KeyUsage },
          { header: "Description", cell: (k) => k.Description || "-" },
        ]}
        empty={<EmptyState title={awsManaged ? "No AWS managed keys" : "No customer managed keys"} description={awsManaged ? "AWS managed keys appear when a service creates one (for example aws/secretsmanager)." : "You don't have any customer managed keys."} action={!awsManaged && <LinkButton href="/kms/keys/create">Create key</LinkButton>} />}
      />
    </Container>
  );
}

export default async function KeysPage({ searchParams }: PageProps<"/kms/keys">) {
  const awsManaged = (await searchParams).scope === "aws";
  return (
    <Page>
      <Suspense key={String(awsManaged)} fallback={<Container header={<Header>Keys</Header>}>Loading keys…</Container>}>
        <Keys awsManaged={awsManaged} />
      </Suspense>
    </Page>
  );
}
