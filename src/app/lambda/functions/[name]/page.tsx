import { GetFunctionCommand } from "@aws-sdk/client-lambda";
import { unzipSync, strFromU8 } from "fflate";
import { aws, errorMessage } from "@/lib/emulator";
import { fetchFromEmulator } from "@/lib/fetch-emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Container, ErrorAlert, FormField, Header, Input, KeyValue, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { deployCode, updateConfig } from "../../actions";
import { InvokePanel } from "../../invoke-panel";
import { runtimeInfo, templateFor } from "../../templates";

async function loadSource(location: string | undefined, runtime: string | undefined) {
  const rt = runtimeInfo(runtime);
  if (location) {
    try {
      const files = unzipSync(new Uint8Array(await fetchFromEmulator(location)));
      const name = files[rt.file] ? rt.file : Object.keys(files).find((f) => !f.endsWith("/"));
      if (name) return { file: name, source: strFromU8(files[name]), fromEmulator: true };
    } catch {
      /* fall back to template */
    }
  }
  return { file: rt.file, source: templateFor(runtime ?? "nodejs22.x"), fromEmulator: false };
}

export default async function FunctionPage({ params, searchParams }: PageProps<"/lambda/functions/[name]">) {
  const name = decodeURIComponent((await params).name);
  const tab = String((await searchParams).tab ?? "code");
  let fn;
  try {
    const { lambda } = await aws();
    fn = await lambda.send(new GetFunctionCommand({ FunctionName: name }));
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const cfg = fn.Configuration!;
  const base = `/lambda/functions/${encodeURIComponent(name)}`;
  return (
    <Page>
      <Header variant="h1" info>{name}</Header>
      <Container header={<Header>Function overview</Header>}>
        <KeyValue
          items={[
            { label: "Description", value: cfg.Description || "-" },
            { label: "Last modified", value: formatDate(cfg.LastModified) },
            { label: "Function ARN", value: <span className="font-mono text-[13px] break-all">{cfg.FunctionArn}</span> },
            { label: "State", value: cfg.State === "Active" ? <StatusIndicator type="success">Active</StatusIndicator> : (cfg.State ?? "-") },
            { label: "Runtime", value: cfg.Runtime },
            { label: "Handler", value: cfg.Handler },
          ]}
        />
      </Container>
      <Tabs
        base={base}
        active={tab}
        tabs={[
          { id: "code", label: "Code" },
          { id: "test", label: "Test" },
          { id: "configuration", label: "Configuration" },
        ]}
      />
      {tab === "code" && <CodeTab name={name} location={fn.Code?.Location} runtime={cfg.Runtime} codeSize={cfg.CodeSize} />}
      {tab === "test" && (
        <Container header={<Header info description="Invoke the function in the emulator with a test event.">Test event</Header>}>
          <InvokePanel name={name} />
        </Container>
      )}
      {tab === "configuration" && (
        <Container header={<Header>General configuration</Header>}>
          <form action={updateConfig} className="space-y-5">
            <input type="hidden" name="name" value={name} />
            <FormField label="Description">
              <Input name="description" defaultValue={cfg.Description ?? ""} />
            </FormField>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField label="Memory (MB)" constraint="Between 128 MB and 10240 MB">
                <Input name="memory" type="number" min={128} max={10240} defaultValue={cfg.MemorySize ?? 128} />
              </FormField>
              <FormField label="Timeout (seconds)" constraint="Between 1 and 900 seconds">
                <Input name="timeout" type="number" min={1} max={900} defaultValue={cfg.Timeout ?? 3} />
              </FormField>
            </div>
            <FormField label="Environment variables" description="One KEY=value per line.">
              <Textarea
                name="env"
                rows={5}
                defaultValue={Object.entries(cfg.Environment?.Variables ?? {}).map(([k, v]) => `${k}=${v}`).join("\n")}
              />
            </FormField>
            <KeyValue
              columns={3}
              items={[
                { label: "Execution role", value: <span className="font-mono text-[13px] break-all">{cfg.Role}</span> },
                { label: "Package type", value: cfg.PackageType ?? "Zip" },
                { label: "Architecture", value: cfg.Architectures?.join(", ") ?? "x86_64" },
              ]}
            />
            <div className="flex justify-end">
              <button className={buttonClass("primary")}>Save</button>
            </div>
          </form>
        </Container>
      )}
    </Page>
  );
}

async function CodeTab({ name, location, runtime, codeSize }: { name: string; location?: string; runtime?: string; codeSize?: number }) {
  const { file, source, fromEmulator } = await loadSource(location, runtime);
  return (
    <Container
      header={
        <Header info description={fromEmulator ? `Editing ${file} from the deployed package (${formatBytes(codeSize)}).` : `The deployed package could not be read, so this shows the ${runtime} template. Deploying replaces the package with this single file.`}>
          Code source
        </Header>
      }
    >
      <form action={deployCode} className="space-y-3">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="file" value={file} />
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="border-b border-line bg-[#f6f6f5] px-3 py-1.5 font-mono text-xs text-muted">{file}</div>
          <textarea name="source" defaultValue={source} rows={20} spellCheck={false} className="block w-full bg-[#fbfbfa] p-3 font-mono text-[13px] leading-5 focus:outline-none" />
        </div>
        <div className="flex justify-end">
          <button className={buttonClass("primary")}>Deploy</button>
        </div>
      </form>
    </Container>
  );
}
