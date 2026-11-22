import Link from "next/link";
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

async function Policies({ scope }: { scope: "Local" | "AWS" | "All" }) {
  let policies: Policy[] = [];
  let error: string | null = null;
  try {
    const { iam } = await aws();
    policies = (await iam.send(new ListPoliciesCommand({ Scope: scope, MaxItems: 1000 }))).Policies ?? [];
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
            description="A policy is an object that defines permissions."
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded border border-control-border text-sm">
              {([["All", "All types"], ["Local", "Customer managed"], ["AWS", "AWS managed"]] as const).map(([v, l]) => (
                <Link key={v} href={v === "All" ? "/iam/policies" : `/iam/policies?scope=${v}`} className={v === scope ? "bg-primary px-3 py-[3px] text-on-primary" : "px-3 py-[3px] hover:bg-hover"}>
                  {l}
                </Link>
              ))}
            </div>
            <div className="min-w-60 flex-1"><TableFilter tableId="policies-table" placeholder="Filter by policy name" /></div>
          </div>
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="policies-table"
        formId={FORM}
        selection="multi"
        rows={policies}
        rowKey={(p) => p.Arn!}
        filterText={(p) => p.PolicyName!}
        columns={[
          { header: "Policy name", cell: (p) => <Link className="text-accent hover:underline" href={`/iam/policies/${encodeURIComponent(p.Arn!)}`}>{p.PolicyName}</Link> },
          { header: "Type", cell: (p) => (p.Arn?.startsWith("arn:aws:iam::aws:") ? "AWS managed" : "Customer managed") },
          { header: "Attached entities", cell: (p) => p.AttachmentCount ?? 0 },
          { header: "Description", cell: (p) => p.Description || "-" },
          { header: "Created", cell: (p) => formatDate(p.CreateDate) },
        ]}
        empty={<EmptyState title="No policies" />}
      />
    </Container>
  );
}

export default async function PoliciesPage({ searchParams }: PageProps<"/iam/policies">) {
  const s = (await searchParams).scope;
  const scope = s === "Local" || s === "AWS" ? s : "All";
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Policies</Header>}>Loading policies…</Container>}>
        <Policies scope={scope} />
      </Suspense>
    </Page>
  );
}
