import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, Select, Textarea, buttonClass } from "@/components/ui";
import { createStack } from "../../actions";
import { CoverageBanner, SAMPLE_TEMPLATE } from "../../shared";

export const metadata = { title: "Create stack | CloudFormation" };

export default function CreateStack() {
  return (
    <Page wide>
      <Header variant="h1" info>Create stack</Header>
      <CoverageBanner />
      <form action={createStack} className="flex flex-col gap-6">
        <Container header={<Header description="Paste a JSON or YAML template, or upload a file (the file wins).">Specify template</Header>}>
          <div className="space-y-4">
            <input type="file" name="file" accept=".json,.yaml,.yml,.template,.txt" className="block text-sm" />
            <Textarea name="template" rows={22} defaultValue={SAMPLE_TEMPLATE} spellCheck={false} />
          </div>
        </Container>
        <Container header={<Header>Stack details</Header>}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="Stack name" constraint="Can include letters (A-Z and a-z), numbers (0-9), and dashes (-).">
              <Input name="name" required maxLength={128} pattern="[A-Za-z][A-Za-z0-9\-]*" />
            </FormField>
            <FormField label="Stack failure options">
              <Select name="onFailure" defaultValue="ROLLBACK">
                <option value="ROLLBACK">Roll back all stack resources</option>
                <option value="DO_NOTHING">Preserve successfully provisioned resources</option>
                <option value="DELETE">Delete the stack</option>
              </Select>
            </FormField>
            <FormField label="Parameters" description="One Key=Value per line; omitted parameters use their defaults.">
              <Textarea name="parameters" rows={4} placeholder="Env=dev" />
            </FormField>
          </div>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/cloudformation/stacks" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Submit</button>
        </div>
      </form>
    </Page>
  );
}
