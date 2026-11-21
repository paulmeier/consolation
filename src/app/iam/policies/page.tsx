import { Suspense } from "react";
import { ListPoliciesCommand, type Policy } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Textarea, buttonClass } from "@/components/ui";
import { createPolicy, deletePolicies } from "../actions";

export const metadata = { title: "Policies | IAM" };
const FORM = "policies-form";

const SAMPLE = JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:GetObject"], Resource: ["arn:aws:s3:::my-bucket/*"] }] }, null, 2);

async function Policies() {
  let policies: Policy[] = [];
  let error: string | null = null;
  try {
    const { iam } = await aws();
    policies = (await iam.send(new ListPoliciesCommand({ Scope: "Local", MaxItems: 1000 }))).Policies ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={policies.length}
            info
            description="A policy is an object that defines permissions. These are your customer managed policies."
            actions={
              <>
                <LinkButton href="/iam/policies" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deletePolicies} label="Delete" title="Delete policy" noun="policy" confirmWord="delete" />
                <ModalButton label="Create policy" title="Create policy" variant="primary" size="lg">
                  <form action={createPolicy} className="space-y-4">
                    <FormField label="Policy name" constraint="Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.">
                      <Input name="name" required maxLength={128} pattern="[\w+=,.@\-]+" />
                    </FormField>
                    <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}>
                      <Input name="description" maxLength={1000} />
                    </FormField>
                    <FormField label="Policy editor (JSON)">
                      <Textarea name="document" rows={12} defaultValue={SAMPLE} spellCheck={false} />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create policy</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Policies
          </Header>
          <TableFilter tableId="policies-table" placeholder="Filter by policy name" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="policies-table"
        formId={FORM}
        selection="single"
        rows={policies}
        rowKey={(p) => p.Arn!}
        filterText={(p) => p.PolicyName!}
        columns={[
          { header: "Policy name", cell: (p) => p.PolicyName },
          { header: "Type", cell: () => "Customer managed" },
          { header: "Attached entities", cell: (p) => p.AttachmentCount ?? 0 },
          { header: "Description", cell: (p) => p.Description || "-" },
          { header: "Created", cell: (p) => formatDate(p.CreateDate) },
        ]}
        empty={<EmptyState title="No customer managed policies" />}
      />
    </Container>
  );
}

export default function PoliciesPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Policies</Header>}>Loading policies…</Container>}>
        <Policies />
      </Suspense>
    </Page>
  );
}
