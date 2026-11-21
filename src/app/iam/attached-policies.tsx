import type { AttachedPolicy } from "@aws-sdk/client-iam";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, FormField, Header, Input, buttonClass } from "@/components/ui";
import { attachPolicy, detachPolicies } from "./actions";

export function AttachedPolicies({ kind, principal, policies }: { kind: "user" | "role"; principal: string; policies: AttachedPolicy[] }) {
  const form = `${kind}-policies-form`;
  return (
    <Container
      noPadding
      header={
        <Header
          counter={policies.length}
          description="You can attach up to 10 managed policies."
          actions={
            <>
              <ConfirmAction formId={form} action={detachPolicies} extra={{ kind, principal }} label="Remove" title="Remove policy" noun="policy" confirmWord="remove" confirmLabel="Remove" />
              <ModalButton label="Add permissions" title="Attach policy" variant="primary">
                <form action={attachPolicy} className="space-y-4">
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="principal" value={principal} />
                  <FormField label="Policy ARN" description="An AWS managed policy such as arn:aws:iam::aws:policy/ReadOnlyAccess, or one of your customer managed policies.">
                    <Input name="policy" required placeholder="arn:aws:iam::aws:policy/ReadOnlyAccess" autoFocus />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Add permissions</button></div>
                </form>
              </ModalButton>
            </>
          }
        >
          Permissions policies
        </Header>
      }
    >
      <form id={form} />
      <Table
        formId={form}
        selection="multi"
        rows={policies}
        rowKey={(p) => p.PolicyArn!}
        columns={[
          { header: "Policy name", cell: (p) => p.PolicyName },
          { header: "Type", cell: (p) => (p.PolicyArn?.startsWith("arn:aws:iam::aws:") ? "AWS managed" : "Customer managed") },
          { header: "ARN", cell: (p) => <span className="font-mono text-[13px]">{p.PolicyArn}</span> },
        ]}
        empty={<EmptyState title="No policies attached" />}
      />
    </Container>
  );
}
