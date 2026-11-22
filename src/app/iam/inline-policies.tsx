import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, FormField, Header, Input, Textarea, buttonClass } from "@/components/ui";
import { deleteInlinePolicies, putInlinePolicy } from "./actions";
import { SAMPLE_POLICY } from "./policy-options";

function Editor({ kind, principal, name, doc }: { kind: string; principal: string; name?: string; doc?: string }) {
  return (
    <form action={putInlinePolicy} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="principal" value={principal} />
      {name ? (
        <input type="hidden" name="policyName" value={name} />
      ) : (
        <FormField label="Policy name" constraint="Up to 128 letters, numbers and +=,.@-_ characters.">
          <Input name="policyName" required maxLength={128} pattern="[\w+=,.@\-]+" />
        </FormField>
      )}
      <FormField label="Policy editor (JSON)">
        <Textarea name="document" rows={14} spellCheck={false} defaultValue={doc ?? SAMPLE_POLICY} />
      </FormField>
      <div className="flex justify-end"><button className={buttonClass("primary")}>{name ? "Save changes" : "Create policy"}</button></div>
    </form>
  );
}

/** Inline (embedded) policies of a user, group or role, with a JSON editor. */
export function InlinePolicies({ kind, principal, policies }: { kind: "user" | "group" | "role"; principal: string; policies: { name: string; doc: string }[] }) {
  const form = `${kind}-inline-form`;
  return (
    <Container
      noPadding
      header={
        <Header
          counter={policies.length}
          description="Inline policies are embedded in this identity and deleted with it."
          actions={
            <>
              <ConfirmAction formId={form} action={deleteInlinePolicies} extra={{ kind, principal }} label="Delete" title="Delete inline policy" noun="inline policy" />
              <ModalButton label="Create inline policy" title="Create inline policy" size="lg">
                <Editor kind={kind} principal={principal} />
              </ModalButton>
            </>
          }
        >
          Inline policies
        </Header>
      }
    >
      <form id={form} />
      <Table
        formId={form}
        selection="multi"
        rows={policies}
        rowKey={(p) => p.name}
        columns={[
          { header: "Policy name", cell: (p) => p.name, width: "220px" },
          {
            header: "Document",
            cell: (p) => (
              <details>
                <summary className="cursor-pointer text-accent">View JSON</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px]">{p.doc}</pre>
              </details>
            ),
          },
          {
            header: "",
            sortable: false,
            width: "90px",
            cell: (p) => (
              <ModalButton label="Edit" title={`Edit ${p.name}`} size="lg">
                <Editor kind={kind} principal={principal} name={p.name} doc={p.doc} />
              </ModalButton>
            ),
          },
        ]}
        empty={<EmptyState title="No inline policies" />}
      />
    </Container>
  );
}
