import { Suspense } from "react";
import { DescribeKeyPairsCommand, type KeyPairInfo } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { deleteKeyPairs } from "../actions";
import { CreateKeyPair } from "../create-key-pair";

export const metadata = { title: "Key pairs | EC2" };
const FORM = "kp-form";

async function KeyPairs() {
  let keys: KeyPairInfo[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    keys = (await ec2.send(new DescribeKeyPairsCommand({}))).KeyPairs ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={keys.length}
            info
            actions={
              <>
                <LinkButton href="/ec2/key-pairs" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteKeyPairs} label="Delete" title="Delete key pair" noun="key pair" confirmWord="Delete" />
                <ModalButton label="Create key pair" title="Create key pair" variant="primary" keepOpen>
                  <CreateKeyPair />
                </ModalButton>
              </>
            }
          >
            Key pairs
          </Header>
          <TableFilter tableId="kp-table" placeholder="Find Key Pair by attribute or tag" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="kp-table"
        formId={FORM}
        selection="multi"
        rows={keys}
        rowKey={(k) => k.KeyName!}
        filterText={(k) => `${k.KeyName} ${k.KeyPairId}`}
        columns={[
          { header: "Name", cell: (k) => k.KeyName },
          { header: "Type", cell: (k) => k.KeyType ?? "rsa" },
          { header: "Created", cell: (k) => formatDate(k.CreateTime) },
          { header: "Fingerprint", cell: (k) => <span className="font-mono text-[13px] break-all">{k.KeyFingerprint}</span> },
          { header: "ID", cell: (k) => <span className="font-mono text-[13px]">{k.KeyPairId}</span> },
        ]}
        empty={<EmptyState title="No key pairs to display" />}
      />
    </Container>
  );
}

export default function KeyPairsPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Key pairs</Header>}>Loading…</Container>}>
        <KeyPairs />
      </Suspense>
    </Page>
  );
}
