import type { AttachedPolicy, Policy } from "@aws-sdk/client-iam";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, FormField, Header, Input, buttonClass } from "@/components/ui";
import { attachGroupPolicy, attachPolicy, detachGroupPolicies, detachPolicies } from "./actions";

export function PolicyDatalist({ id, options }: { id: string; options: Policy[] }) {
  return (
    <datalist id={id}>
      {options.map((p) => (
        <option key={p.Arn} value={p.Arn}>{p.PolicyName}</option>
      ))}
    </datalist>
  );
}

export function AttachedPolicies({ kind, principal, policies, options = [] }: { kind: "user" | "role" | "group"; principal: string; policies: AttachedPolicy[]; options?: Policy[] }) {
  const form = `${kind}-policies-form`;
  const group = kind === "group";
  return (
    <Container
      noPadding
      header={
        <Header
          counter={policies.length}
          description="Managed policies attached directly. You can attach up to 10."
          actions={
            <>
              <ConfirmAction formId={form} action={group ? detachGroupPolicies : detachPolicies} extra={{ kind, principal }} label="Remove" title="Remove policy" noun="policy" confirmWord="remove" confirmLabel="Remove" />
              <ModalButton label="Add permissions" title="Attach policy" variant="primary">
                <form action={group ? attachGroupPolicy : attachPolicy} className="space-y-4">
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="principal" value={principal} />
                  <FormField label="Policy" description="Start typing a policy name or paste an ARN. AWS managed and your customer managed policies are suggested.">
                    <Input name="policy" required list={`${form}-options`} placeholder="arn:aws:iam::aws:policy/ReadOnlyAccess" autoFocus />
                  </FormField>
                  <PolicyDatalist id={`${form}-options`} options={options} />
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
          { header: "Policy name", cell: (p) => <a className="text-accent hover:underline" href={`/iam/policies/${encodeURIComponent(p.PolicyArn ?? "")}`}>{p.PolicyName}</a> },
          { header: "Type", cell: (p) => (p.PolicyArn?.startsWith("arn:aws:iam::aws:") ? "AWS managed" : "Customer managed") },
          { header: "ARN", cell: (p) => <span className="font-mono text-[13px]">{p.PolicyArn}</span> },
        ]}
        empty={<EmptyState title="No policies attached" />}
      />
    </Container>
  );
}
