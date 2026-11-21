import { Page } from "@/components/page";
import { Alert, Container, FormField, Header, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { createDatabase } from "../../actions";
import { ENGINES } from "../../shared";

export const metadata = { title: "Create database | RDS" };

export default function CreateDatabase() {
  return (
    <Page>
      <Header variant="h1" info>Create database</Header>
      <form action={createDatabase} className="flex max-w-[960px] flex-col gap-6">
        <Container header={<Header>Engine options</Header>}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {ENGINES.map((e, i) => (
              <label key={e.id} className="flex items-center gap-2 rounded-xl border border-line-strong p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name="engine" value={e.id} defaultChecked={i === 0} className="accent-accent" /> {e.label}
              </label>
            ))}
          </div>
        </Container>
        <Container header={<Header>Settings</Header>}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="DB identifier" constraint="1-63 alphanumeric characters or hyphens; must start with a letter.">
              <Input name="id" required maxLength={63} pattern="[A-Za-z][A-Za-z0-9\-]*" placeholder="database-1" />
            </FormField>
            <FormField label="Master username"><Input name="username" defaultValue="dbadmin" pattern="[A-Za-z][A-Za-z0-9_]*" /></FormField>
            <div className="md:col-span-2">
              <Alert>The master password is generated and managed in AWS Secrets Manager. Retrieve it from the database detail page.</Alert>
            </div>
          </div>
        </Container>
        <Container header={<Header>Instance configuration and storage</Header>}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="DB instance class"><Select name="class" defaultValue="db.t3.micro">{["db.t3.micro", "db.t3.small", "db.t3.medium", "db.r6g.large", "db.m6g.large", "db.serverless"].map((c) => <option key={c}>{c}</option>)}</Select></FormField>
            <FormField label="Allocated storage (GiB)" description="Not used for Aurora."><Input name="storage" type="number" min={20} max={65536} defaultValue={20} /></FormField>
            <FormField label={<>Initial database name <i className="font-normal text-muted">- optional</i></>}><Input name="dbname" pattern="[A-Za-z][A-Za-z0-9_]*" /></FormField>
            <div className="space-y-2 pt-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="multiAz" className="accent-accent" /> Multi-AZ DB instance</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="dataApi" className="accent-accent" /> Enable the RDS Data API (Aurora)</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="protect" className="accent-accent" /> Enable deletion protection</label>
            </div>
          </div>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/rds/databases" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Create database</button>
        </div>
      </form>
    </Page>
  );
}
