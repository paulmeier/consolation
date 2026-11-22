import type { Image } from "@aws-sdk/client-ec2";
import { FormField, Input, Select, Textarea } from "@/components/ui";
import { INSTANCE_TYPES } from "./util";

/** Launch template data fields shared by "create template" and "create version". */
export function TemplateFields({
  images,
  keys,
  groups,
  initial,
}: {
  images: Image[];
  keys: string[];
  groups: { id: string; name: string }[];
  initial?: { ami?: string; type?: string; key?: string; groups?: string[]; userData?: string };
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="AMI">
          <Select name="ami" defaultValue={initial?.ami ?? ""}>
            <option value="">Don&apos;t include in template</option>
            {images.map((i) => <option key={i.ImageId} value={i.ImageId}>{i.Name ?? i.ImageId} ({i.ImageId})</option>)}
          </Select>
        </FormField>
        <FormField label="Instance type">
          <Select name="type" defaultValue={initial?.type ?? ""}>
            <option value="">Don&apos;t include in template</option>
            {INSTANCE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </FormField>
        <FormField label="Key pair">
          <Select name="key" defaultValue={initial?.key ?? ""}>
            <option value="">Don&apos;t include in template</option>
            {keys.map((k) => <option key={k}>{k}</option>)}
          </Select>
        </FormField>
        <FormField label="Security groups">
          <div className="max-h-28 space-y-1 overflow-auto rounded border border-control-border px-3 py-2">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="groups" value={g.id} defaultChecked={initial?.groups?.includes(g.id)} className="accent-accent" /> {g.name}
              </label>
            ))}
          </div>
        </FormField>
      </div>
      <FormField label={<>User data <i className="font-normal text-muted">- optional</i></>}>
        <Textarea name="userData" rows={4} defaultValue={initial?.userData ?? ""} />
      </FormField>
      <FormField label={<>Version description <i className="font-normal text-muted">- optional</i></>}>
        <Input name="description" maxLength={255} />
      </FormField>
    </div>
  );
}
