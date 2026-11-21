import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { createFunction } from "../../actions";
import { RUNTIMES } from "../../templates";

export const metadata = { title: "Create function | Lambda" };

export default function CreateFunction() {
  return (
    <Page>
      <Header variant="h1" info description="Choose one of the following options to create your function.">Create function</Header>
      <form action={createFunction} className="flex max-w-[960px] flex-col gap-6">
        <Container>
          <label className="flex items-start gap-3 rounded-xl border-2 border-accent bg-accent-soft p-4">
            <input type="radio" defaultChecked className="mt-1 accent-accent" readOnly />
            <span>
              <span className="font-bold">Author from scratch</span>
              <span className="block text-sm text-muted">Start with a simple Hello World example.</span>
            </span>
          </label>
        </Container>
        <Container header={<Header>Basic information</Header>}>
          <div className="space-y-5">
            <FormField label="Function name" description="Enter a name that describes the purpose of your function." constraint="Function name must be 1 to 64 characters, must be unique to the Region, and can't include spaces. Valid characters are a-z, A-Z, 0-9, hyphens (-), and underscores (_).">
              <Input name="name" required maxLength={64} pattern="[A-Za-z0-9_\-]+" placeholder="myFunctionName" />
            </FormField>
            <FormField label="Runtime" description="Choose the language to use to write your function.">
              <Select name="runtime" defaultValue="nodejs22.x">
                {RUNTIMES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            </FormField>
            <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}>
              <Input name="description" />
            </FormField>
            <FormField label={<>Execution role <i className="font-normal text-muted">- optional</i></>} description="Leave empty to create or reuse the role consolation-lambda-execution-role.">
              <Input name="role" placeholder="arn:aws:iam::000000000000:role/..." />
            </FormField>
          </div>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/lambda/functions" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Create function</button>
        </div>
      </form>
    </Page>
  );
}
