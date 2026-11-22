import { REGION } from "@/lib/emulator";
import { regionLabel } from "@/lib/format";
import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, buttonClass } from "@/components/ui";
import { createBucket } from "../../actions";

export const metadata = { title: "Create bucket" };

export default function CreateBucket() {
  return (
    <Page>
      <Header variant="h1" info description="Buckets are containers for data stored in S3.">
        Create bucket
      </Header>
      <form action={createBucket} className="flex max-w-[960px] flex-col gap-6">
        <Container header={<Header>General configuration</Header>}>
          <div className="space-y-5">
            <FormField label="AWS Region">
              <p>
                {regionLabel(REGION)} {REGION}
              </p>
            </FormField>
            <FormField
              label="Bucket name"
              htmlFor="name"
              constraint="Bucket names must be 3 to 63 characters and unique within the global namespace. Bucket names must also begin and end with a letter or number. Valid characters are a-z, 0-9, periods (.), and hyphens (-)."
            >
              <Input id="name" name="name" required minLength={3} maxLength={63} pattern="[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]" placeholder="myawsbucket" />
            </FormField>
          </div>
        </Container>
        <Container header={<Header info>Bucket Versioning</Header>}>
          <p className="mb-3 text-sm text-muted">Versioning is a means of keeping multiple variants of an object in the same bucket.</p>
          <label className="mr-6 inline-flex items-center gap-2">
            <input type="radio" name="versioning" value="off" defaultChecked className="accent-accent" /> Disable
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="versioning" value="on" className="accent-accent" /> Enable
          </label>
        </Container>
        <Container header={<Header info description="Store objects with a write-once-read-many (WORM) model. Object Lock can only be turned on when the bucket is created, and it turns on versioning.">Object Lock</Header>}>
          <label className="mr-6 inline-flex items-center gap-2">
            <input type="radio" name="objectLock" value="off" defaultChecked className="accent-accent" /> Disable
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="objectLock" value="on" className="accent-accent" /> Enable
          </label>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/s3/buckets" variant="link">
            Cancel
          </LinkButton>
          <button type="submit" className={buttonClass("primary")}>
            Create bucket
          </button>
        </div>
      </form>
    </Page>
  );
}
