import { DescribeImagesCommand, DescribeRepositoriesCommand } from "@aws-sdk/client-ecr";
import { aws } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, Select, buttonClass } from "@/components/ui";
import { createFunction } from "../../actions";
import { RUNTIMES } from "../../templates";

export const metadata = { title: "Create function | Lambda" };

/** Image URIs in this account's ECR repositories, for the container image option. */
async function ecrImages() {
  try {
    const { ecr } = await aws();
    const repos = (await ecr.send(new DescribeRepositoriesCommand({}))).repositories ?? [];
    const lists = await Promise.all(
      repos.map(async (r) =>
        ((await ecr.send(new DescribeImagesCommand({ repositoryName: r.repositoryName! })).catch(() => ({ imageDetails: [] }))).imageDetails ?? []).flatMap((i) =>
          (i.imageTags?.length ? i.imageTags.map((t) => `${r.repositoryUri}:${t}`) : [`${r.repositoryUri}@${i.imageDigest}`]),
        ),
      ),
    );
    return lists.flat();
  } catch {
    return [];
  }
}

export default async function CreateFunction() {
  const images = await ecrImages();
  return (
    <Page>
      <Header variant="h1" info description="Choose one of the following options to create your function.">Create function</Header>
      <form action={createFunction} className="flex max-w-[960px] flex-col gap-6">
        <Container>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-line p-4 has-checked:border-accent has-checked:bg-accent-soft">
              <input type="radio" name="packageType" value="Zip" defaultChecked className="mt-1 accent-accent" />
              <span>
                <span className="font-bold">Author from scratch</span>
                <span className="block text-sm text-muted">Start with a simple Hello World example.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-line p-4 has-checked:border-accent has-checked:bg-accent-soft">
              <input type="radio" name="packageType" value="Image" className="mt-1 accent-accent" />
              <span>
                <span className="font-bold">Container image</span>
                <span className="block text-sm text-muted">Select a container image from Amazon ECR to deploy for your function.</span>
              </span>
            </label>
          </div>
        </Container>
        <Container header={<Header>Basic information</Header>}>
          <div className="space-y-5">
            <FormField label="Function name" description="Enter a name that describes the purpose of your function." constraint="Function name must be 1 to 64 characters, must be unique to the Region, and can't include spaces. Valid characters are a-z, A-Z, 0-9, hyphens (-), and underscores (_).">
              <Input name="name" required maxLength={64} pattern="[A-Za-z0-9_\-]+" placeholder="myFunctionName" />
            </FormField>
            <FormField label="Runtime" description="For Author from scratch: the language to use to write your function.">
              <Select name="runtime" defaultValue="nodejs22.x">
                {RUNTIMES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Container image URI" description="For Container image: an image in Amazon ECR. The emulator checks that the image exists.">
              <Input name="imageUri" list="ecr-images" placeholder="000000000000.dkr.ecr.us-east-1.amazonaws.com/my-repo:latest" />
              <datalist id="ecr-images">{images.map((i) => <option key={i} value={i} />)}</datalist>
            </FormField>
            <FormField label="Architecture">
              <Select name="architecture" defaultValue="x86_64">
                <option value="x86_64">x86_64</option>
                <option value="arm64">arm64</option>
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
