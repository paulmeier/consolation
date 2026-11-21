import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { createTable } from "../../actions";

export const metadata = { title: "Create table | DynamoDB" };

function TypeSelect({ name }: { name: string }) {
  return (
    <Select name={name} defaultValue="S" className="w-36">
      <option value="S">String</option>
      <option value="N">Number</option>
      <option value="B">Binary</option>
    </Select>
  );
}

export default function CreateTable() {
  return (
    <Page>
      <Header variant="h1" info>Create table</Header>
      <form action={createTable} className="flex max-w-[960px] flex-col gap-6">
        <Container header={<Header>Table details</Header>}>
          <div className="space-y-5">
            <FormField label="Table name" description="This will be used to identify your table." constraint="Between 3 and 255 characters, containing only letters, numbers, underscores (_), hyphens (-), and periods (.).">
              <Input name="name" required minLength={3} maxLength={255} pattern="[A-Za-z0-9_.\-]+" placeholder="Enter the table name" />
            </FormField>
            <FormField label="Partition key" description="The partition key is part of the table's primary key. It is a hash value that is used to retrieve items from your table and allocate data across hosts for scalability and availability.">
              <div className="flex gap-2">
                <Input name="pk" required placeholder="Enter the partition key name" />
                <TypeSelect name="pkType" />
              </div>
            </FormField>
            <FormField label={<>Sort key <i className="font-normal text-muted">- optional</i></>} description="You can use a sort key as the second part of a table's primary key.">
              <div className="flex gap-2">
                <Input name="sk" placeholder="Enter the sort key name" />
                <TypeSelect name="skType" />
              </div>
            </FormField>
          </div>
        </Container>
        <Container header={<Header>Table settings</Header>}>
          <p className="text-sm">Capacity mode: <b>On-demand</b>. Other settings use defaults.</p>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/dynamodb/tables" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Create table</button>
        </div>
      </form>
    </Page>
  );
}
