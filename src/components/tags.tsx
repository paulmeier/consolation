import { Table } from "./table";
import { ModalButton } from "./client/modal";
import { ConfirmAction } from "./client/confirm-action";
import { Container, EmptyState, FormField, Header, Input, buttonClass } from "./ui";

/** Reusable Tags container: list, add (modal) and remove (confirm) for any resource. */
export function TagsPanel({
  tags,
  addAction,
  removeAction,
  hidden,
  formId = "tags-form",
}: {
  tags: { Key?: string; Value?: string }[];
  addAction: (fd: FormData) => Promise<void>;
  removeAction: (fd: FormData) => Promise<void>;
  hidden: Record<string, string>;
  formId?: string;
}) {
  const hiddenInputs = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  return (
    <Container
      noPadding
      header={
        <Header
          counter={tags.length}
          description="Tags are labels that help you organize and track resources."
          actions={
            <>
              <ConfirmAction formId={formId} action={removeAction} extra={hidden} label="Remove" title="Remove tags" noun="tag" confirmWord="remove" confirmLabel="Remove" />
              <ModalButton label="Add tag" title="Add tag">
                <form action={addAction} className="space-y-4">
                  {hiddenInputs}
                  <FormField label="Key">
                    <Input name="key" required maxLength={128} autoFocus />
                  </FormField>
                  <FormField label={<>Value <i className="font-normal text-muted">- optional</i></>}>
                    <Input name="value" maxLength={256} />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Add tag</button></div>
                </form>
              </ModalButton>
            </>
          }
        >
          Tags
        </Header>
      }
    >
      <form id={formId} />
      <Table
        formId={formId}
        selection="multi"
        rows={tags}
        rowKey={(t) => t.Key ?? ""}
        columns={[
          { header: "Key", cell: (t) => t.Key },
          { header: "Value", cell: (t) => t.Value || "-" },
        ]}
        empty={<EmptyState title="No tags" description="No tags associated with the resource." />}
      />
    </Container>
  );
}
