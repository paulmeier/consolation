import type { Parameter, ParameterMetadata } from "@aws-sdk/client-ssm";
import { Container, FormField, Header, Input, LinkButton, Select, Textarea, buttonClass } from "@/components/ui";
import { putParameter } from "./actions";

/** Create / edit form shared by the create page and the detail page's Edit tab. */
export function ParameterForm({ existing, meta, cancelHref }: { existing?: Parameter; meta?: ParameterMetadata; cancelHref: string }) {
  const editing = !!existing;
  return (
    <form action={putParameter} className="flex max-w-[960px] flex-col gap-6">
      <input type="hidden" name="overwrite" value={editing ? "true" : "false"} />
      <Container header={<Header>Parameter details</Header>}>
        <div className="space-y-5">
          <FormField
            label="Name"
            constraint="Parameter names are case-sensitive and can contain letters, numbers and the symbols . - _ /. Hierarchies start with / (for example /dev/db/password)."
          >
            <Input name="name" required maxLength={2048} pattern="[A-Za-z0-9_.\-\/]+" defaultValue={existing?.Name} readOnly={editing} placeholder="/Dev/DBServer/MySQL/db-string13" />
          </FormField>
          <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}>
            <Input name="description" maxLength={1024} defaultValue={meta?.Description ?? ""} />
          </FormField>
          <FormField label="Tier" description="Standard parameters hold up to 4 KB; advanced parameters up to 8 KB.">
            <Select name="tier" defaultValue={meta?.Tier ?? "Standard"}>
              <option value="Standard">Standard</option>
              <option value="Advanced">Advanced</option>
              <option value="Intelligent-Tiering">Intelligent-Tiering</option>
            </Select>
          </FormField>
          <FormField label="Type" description={editing ? "The type can't be changed after creation." : undefined}>
            <Select name="type" defaultValue={existing?.Type ?? "String"} disabled={editing}>
              <option value="String">String</option>
              <option value="StringList">StringList</option>
              <option value="SecureString">SecureString</option>
            </Select>
          </FormField>
          {!editing && (
            <FormField label="KMS key (SecureString only)" description="Leave empty for alias/aws/ssm.">
              <Input name="kmsKeyId" placeholder="alias/aws/ssm" />
            </FormField>
          )}
          <FormField label="Data type">
            <Select name="dataType" defaultValue={existing?.DataType ?? "text"}>
              <option value="text">text</option>
              <option value="aws:ec2:image">aws:ec2:image</option>
              <option value="aws:ssm:integration">aws:ssm:integration</option>
            </Select>
          </FormField>
          <FormField label="Value" constraint="Maximum 4096 characters (8 KB for advanced). StringList values are comma separated.">
            <Textarea name="value" required rows={6} defaultValue={existing?.Type === "SecureString" ? "" : (existing?.Value ?? "")} placeholder={existing?.Type === "SecureString" ? "Enter a new value" : ""} />
          </FormField>
        </div>
      </Container>
      <div className="flex justify-end gap-2">
        <LinkButton href={cancelHref} variant="link">Cancel</LinkButton>
        <button className={buttonClass("primary")}>{editing ? "Save changes" : "Create parameter"}</button>
      </div>
    </form>
  );
}
