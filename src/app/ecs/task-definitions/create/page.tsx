import { Page } from "@/components/page";
import { Container, FormField, Header, Input, LinkButton, Select, Textarea, buttonClass } from "@/components/ui";
import { registerTaskDef } from "../../actions";

export const metadata = { title: "Create task definition | ECS" };

export default function CreateTaskDef() {
  return (
    <Page>
      <Header variant="h1" info>Create new task definition</Header>
      <form action={registerTaskDef} className="flex max-w-[960px] flex-col gap-6">
        <Container header={<Header>Task definition configuration</Header>}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="Task definition family"><Input name="family" placeholder="my-web-app" pattern="[A-Za-z0-9_\-]+" /></FormField>
            <FormField label="Launch type"><Select name="launchType" defaultValue="FARGATE"><option>FARGATE</option><option>EC2</option></Select></FormField>
            <FormField label="Network mode"><Select name="networkMode" defaultValue="awsvpc">{["awsvpc", "bridge", "host", "none"].map((m) => <option key={m}>{m}</option>)}</Select></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="CPU (units)"><Select name="cpu" defaultValue="256">{["256", "512", "1024", "2048", "4096"].map((c) => <option key={c}>{c}</option>)}</Select></FormField>
              <FormField label="Memory (MiB)"><Select name="memory" defaultValue="512">{["512", "1024", "2048", "4096", "8192"].map((c) => <option key={c}>{c}</option>)}</Select></FormField>
            </div>
          </div>
        </Container>
        <Container header={<Header>Container - 1</Header>}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="Name"><Input name="container" placeholder="web" /></FormField>
            <FormField label="Image URI"><Input name="image" placeholder="public.ecr.aws/nginx/nginx:latest" defaultValue="public.ecr.aws/nginx/nginx:latest" /></FormField>
            <FormField label="Container port"><Input name="port" type="number" defaultValue={80} /></FormField>
            <FormField label="Environment variables" description="KEY=value per line"><Textarea name="env" rows={3} /></FormField>
          </div>
        </Container>
        <Container header={<Header description="If filled in, the JSON is registered as-is and the form above is ignored.">JSON <i className="font-normal text-muted">- optional</i></Header>}>
          <Textarea name="json" rows={8} placeholder='{"family": "...", "containerDefinitions": [...]}' spellCheck={false} />
        </Container>
        <div className="flex justify-end gap-2">
          <LinkButton href="/ecs/task-definitions" variant="link">Cancel</LinkButton>
          <button className={buttonClass("primary")}>Create</button>
        </div>
      </form>
    </Page>
  );
}
