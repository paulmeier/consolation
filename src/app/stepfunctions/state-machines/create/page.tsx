import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { createStateMachine } from "../../actions";
import { DefinitionEditor } from "../../definition-editor";
import { HELLO_WORLD } from "../../shared";

export const metadata = { title: "Create state machine | Step Functions" };

export default function CreateMachine() {
  return (
    <Page wide>
      <Header variant="h1" info>Create state machine</Header>
      <form action={createStateMachine} className="flex flex-col gap-6">
        <Container header={<Header>Details</Header>}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <FormField label="State machine name" constraint="Up to 80 characters: letters, numbers, - and _.">
              <Input name="name" required maxLength={80} pattern="[A-Za-z0-9_\-]+" placeholder="MyStateMachine" />
            </FormField>
            <FormField label="Type">
              <Select name="type" defaultValue="STANDARD">
                <option value="STANDARD">Standard</option>
                <option value="EXPRESS">Express</option>
              </Select>
            </FormField>
            <FormField label={<>Execution role <i className="font-normal text-muted">- optional</i></>} description="Empty creates or reuses consolation-stepfunctions-role.">
              <Input name="role" placeholder="arn:aws:iam::000000000000:role/..." />
            </FormField>
          </div>
        </Container>
        <Container header={<Header description="Amazon States Language (JSON). The graph updates as you type.">Definition</Header>}>
          <DefinitionEditor name="definition" initial={HELLO_WORLD} />
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/stepfunctions/state-machines" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Create</button>
        </div>
      </form>
    </Page>
  );
}
