import { DescribeImagesCommand, DescribeKeyPairsCommand, DescribeSecurityGroupsCommand, type Image } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Container, ErrorAlert, FormField, Header, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { launchInstance } from "../../actions";

export const metadata = { title: "Launch an instance | EC2" };

const TYPES = ["t2.micro", "t3.micro", "t3.small", "t3.medium", "m5.large", "c5.large", "r5.large"];

export default async function Launch() {
  let images: Image[] = [];
  let keys: string[] = [];
  let groups: { id: string; name: string }[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    const [img, kp, sg] = await Promise.all([
      ec2.send(new DescribeImagesCommand({ Owners: ["amazon"], MaxResults: 50 })),
      ec2.send(new DescribeKeyPairsCommand({})),
      ec2.send(new DescribeSecurityGroupsCommand({})),
    ]);
    images = img.Images ?? [];
    keys = (kp.KeyPairs ?? []).map((k) => k.KeyName!);
    groups = (sg.SecurityGroups ?? []).map((g) => ({ id: g.GroupId!, name: g.GroupName! }));
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Header variant="h1" info description="Amazon EC2 allows you to create virtual machines, or instances, that run on the AWS Cloud. In the emulator, instances are simulated.">
        Launch an instance
      </Header>
      {error && <ErrorAlert message={error} />}
      <form action={launchInstance} className="flex max-w-[960px] flex-col gap-6">
        <Container header={<Header>Name and tags</Header>}>
          <FormField label="Name">
            <Input name="name" placeholder="e.g. My Web Server" />
          </FormField>
        </Container>
        <Container header={<Header info>Application and OS Images (Amazon Machine Image)</Header>}>
          <FormField label="Amazon Machine Image (AMI)">
            <Select name="ami" required>
              {images.map((i) => (
                <option key={i.ImageId} value={i.ImageId}>
                  {i.Name ?? i.Description ?? i.ImageId} ({i.ImageId})
                </option>
              ))}
            </Select>
          </FormField>
        </Container>
        <Container header={<Header info>Instance type</Header>}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="Instance type">
              <Select name="type" defaultValue="t2.micro">
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </FormField>
            <FormField label="Number of instances">
              <Input name="count" type="number" min={1} max={10} defaultValue={1} />
            </FormField>
          </div>
        </Container>
        <Container header={<Header info>Key pair (login)</Header>}>
          <FormField label="Key pair name" description="You can use a key pair to securely connect to your instance.">
            <Select name="key" defaultValue="">
              <option value="">Proceed without a key pair (Not recommended)</option>
              {keys.map((k) => <option key={k}>{k}</option>)}
            </Select>
          </FormField>
        </Container>
        <Container header={<Header info>Network settings</Header>}>
          <FormField label="Security group">
            <Select name="sg" defaultValue="">
              <option value="">Default</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.id})</option>)}
            </Select>
          </FormField>
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/ec2/instances" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")} disabled={!images.length}>Launch instance</button>
        </div>
      </form>
    </Page>
  );
}
