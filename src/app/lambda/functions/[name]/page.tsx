import Link from "next/link";
import {
  GetFunctionCommand,
  GetFunctionConcurrencyCommand,
  GetFunctionEventInvokeConfigCommand,
  GetFunctionUrlConfigCommand,
  GetPolicyCommand,
  ListAliasesCommand,
  ListEventSourceMappingsCommand,
  ListVersionsByFunctionCommand,
  type FunctionConfiguration,
} from "@aws-sdk/client-lambda";
import { DescribeLogStreamsCommand, GetLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { ListQueuesCommand, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import { ListStreamsCommand, DescribeStreamSummaryCommand } from "@aws-sdk/client-kinesis";
import { ListTablesCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { unzipSync, strFromU8 } from "fflate";
import { aws, errorMessage } from "@/lib/emulator";
import { fetchFromEmulator } from "@/lib/fetch-emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { KeyValueEditor } from "@/components/client/kv-editor";
import { Alert, Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, Select, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import {
  addFunctionPermission,
  createAlias,
  createTrigger,
  deleteAliases,
  deleteTriggers,
  deployCode,
  publishVersion,
  removeFunctionPermissions,
  saveDestinations,
  setConcurrency,
  setFunctionUrl,
  toggleTriggers,
  updateConfig,
  uploadZip,
} from "../../actions";
import { InvokePanel } from "../../invoke-panel";
import { runtimeInfo, templateFor } from "../../templates";

async function loadSource(location: string | undefined, runtime: string | undefined) {
  const rt = runtimeInfo(runtime);
  if (location) {
    try {
      const files = unzipSync(new Uint8Array(await fetchFromEmulator(location)));
      const name = files[rt.file] ? rt.file : Object.keys(files).find((f) => !f.endsWith("/"));
      if (name) return { file: name, source: strFromU8(files[name]), fromEmulator: true, count: Object.keys(files).filter((f) => !f.endsWith("/")).length };
    } catch {
      /* fall back to template */
    }
  }
  return { file: rt.file, source: templateFor(runtime ?? "nodejs22.x"), fromEmulator: false, count: 1 };
}

const TABS = [
  { id: "code", label: "Code" },
  { id: "test", label: "Test" },
  { id: "monitor", label: "Monitor" },
  { id: "configuration", label: "Configuration" },
  { id: "aliases", label: "Aliases and versions" },
  { id: "triggers", label: "Triggers" },
];

export default async function FunctionPage({ params, searchParams }: PageProps<"/lambda/functions/[name]">) {
  const name = decodeURIComponent((await params).name);
  const requested = String((await searchParams).tab ?? "");
  const tab = TABS.some((t) => t.id === requested) ? requested : "code";
  let fn;
  try {
    const { lambda } = await aws();
    fn = await lambda.send(new GetFunctionCommand({ FunctionName: name }));
  } catch (e) {
    return (<Page><Header variant="h1">{name}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const cfg = fn.Configuration!;
  const base = `/lambda/functions/${encodeURIComponent(name)}`;
  return (
    <Page wide>
      <Header variant="h1" info actions={<LinkButton href={`${base}?tab=${tab}`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>}>{name}</Header>
      <Container header={<Header>Function overview</Header>}>
        <KeyValue
          items={[
            { label: "Description", value: cfg.Description || "-" },
            { label: "Last modified", value: formatDate(cfg.LastModified) },
            { label: "Function ARN", value: <span className="font-mono text-[13px] break-all">{cfg.FunctionArn}</span> },
            { label: "State", value: cfg.State === "Active" ? <StatusIndicator type="success">Active</StatusIndicator> : (cfg.State ?? "-") },
            { label: "Runtime", value: cfg.Runtime },
            { label: "Layers", value: cfg.Layers?.length ? cfg.Layers.map((l) => l.Arn?.split(":").slice(-2).join(":")).join(", ") : "-" },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={TABS} />
      {tab === "code" && <CodeTab name={name} location={fn.Code?.Location} runtime={cfg.Runtime} codeSize={cfg.CodeSize} />}
      {tab === "test" && (
        <Container header={<Header info description="Invoke the function in the emulator. Saved events are kept in this browser.">Test event</Header>}>
          <InvokePanel name={name} />
        </Container>
      )}
      {tab === "monitor" && <MonitorTab name={name} />}
      {tab === "configuration" && <ConfigurationTab name={name} cfg={cfg} />}
      {tab === "aliases" && <AliasesTab name={name} />}
      {tab === "triggers" && <TriggersTab name={name} />}
    </Page>
  );
}

async function CodeTab({ name, location, runtime, codeSize }: { name: string; location?: string; runtime?: string; codeSize?: number }) {
  const { file, source, fromEmulator, count } = await loadSource(location, runtime);
  return (
    <>
      <Container
        header={
          <Header
            info
            description={fromEmulator ? `Editing ${file} from the deployed package (${formatBytes(codeSize)}, ${count} file${count === 1 ? "" : "s"}).` : `The deployed package could not be read, so this shows the ${runtime} template.`}
            actions={
              <ModalButton label="Upload from .zip file" title="Upload a .zip file">
                <form action={uploadZip} className="space-y-4">
                  <input type="hidden" name="name" value={name} />
                  <input type="file" name="zip" accept=".zip,application/zip" required className="block text-sm" />
                  <p className="text-sm text-muted">Replaces the whole deployment package.</p>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                </form>
              </ModalButton>
            }
          >
            Code source
          </Header>
        }
      >
        {count > 1 && <div className="mb-3"><Alert type="warning">This package has {count} files. Deploying from the editor replaces it with only {file}.</Alert></div>}
        <form action={deployCode} className="space-y-3">
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="file" value={file} />
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="border-b border-line bg-[#f6f6f5] px-3 py-1.5 font-mono text-xs text-muted">{file}</div>
            <textarea name="source" defaultValue={source} rows={20} spellCheck={false} className="block w-full bg-[#fbfbfa] p-3 font-mono text-[13px] leading-5 focus:outline-none" />
          </div>
          <div className="flex justify-end"><button className={buttonClass("primary")}>Deploy</button></div>
        </form>
      </Container>
    </>
  );
}

async function MonitorTab({ name }: { name: string }) {
  const group = `/aws/lambda/${name}`;
  const { logs } = await aws();
  let streams: { name: string; last?: number }[] = [];
  let events: { t?: number; m?: string }[] = [];
  let error: string | null = null;
  try {
    streams = ((await logs.send(new DescribeLogStreamsCommand({ logGroupName: group, orderBy: "LastEventTime", descending: true, limit: 5 }))).logStreams ?? []).map((s) => ({ name: s.logStreamName!, last: s.lastEventTimestamp }));
    if (streams[0]) events = ((await logs.send(new GetLogEventsCommand({ logGroupName: group, logStreamName: streams[0].name, limit: 100, startFromHead: false }))).events ?? []).map((e) => ({ t: e.timestamp, m: e.message }));
  } catch (e) {
    error = errorMessage(e);
  }
  const groupHref = `/cloudwatch/log-groups/${encodeURIComponent(group)}`;
  return (
    <>
      <Container header={<Header description={<>Log group <Link className="underline-link font-mono" href={groupHref}>{group}</Link></>} actions={<LinkButton href={groupHref}>View CloudWatch logs</LinkButton>}>Recent invocations</Header>}>
        {error ? <p className="text-sm text-muted">No logs yet. Invoke the function to create its log group. ({error})</p> : (
          <pre className="max-h-96 overflow-auto rounded-lg bg-[#f6f6f5] p-3 font-mono text-xs whitespace-pre-wrap">{events.map((e) => `${e.t ? new Date(e.t).toISOString() : ""}  ${e.m ?? ""}`).join("\n") || "No events in the latest log stream."}</pre>
        )}
      </Container>
      {streams.length > 0 && (
        <Container noPadding header={<Header counter={streams.length}>Latest log streams</Header>}>
          <Table rows={streams} rowKey={(s) => s.name} columns={[
            { header: "Log stream", cell: (s) => <Link className="underline-link" href={`${groupHref}?stream=${encodeURIComponent(s.name)}`}>{s.name}</Link> },
            { header: "Last event", cell: (s) => formatDate(s.last ? new Date(s.last) : undefined) },
          ]} />
        </Container>
      )}
    </>
  );
}

async function ConfigurationTab({ name, cfg }: { name: string; cfg: FunctionConfiguration }) {
  const { lambda } = await aws();
  const [conc, invoke, url, policy] = await Promise.all([
    lambda.send(new GetFunctionConcurrencyCommand({ FunctionName: name })).catch(() => null),
    lambda.send(new GetFunctionEventInvokeConfigCommand({ FunctionName: name })).catch(() => null),
    lambda.send(new GetFunctionUrlConfigCommand({ FunctionName: name })).catch(() => null),
    lambda.send(new GetPolicyCommand({ FunctionName: name })).catch(() => null),
  ]);
  const statements: { Sid: string; Principal?: unknown; Action?: string; Condition?: unknown }[] = (() => {
    try {
      return JSON.parse(policy?.Policy ?? "{}").Statement ?? [];
    } catch {
      return [];
    }
  })();
  const hidden = <input type="hidden" name="name" value={name} />;
  return (
    <>
      <Container header={<Header>General configuration</Header>}>
        <form action={updateConfig} className="space-y-5">
          {hidden}
          <FormField label="Description"><Input name="description" defaultValue={cfg.Description ?? ""} /></FormField>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="Memory (MB)" constraint="Between 128 MB and 10240 MB"><Input name="memory" type="number" min={128} max={10240} defaultValue={cfg.MemorySize ?? 128} /></FormField>
            <FormField label="Timeout (seconds)" constraint="Between 1 and 900 seconds"><Input name="timeout" type="number" min={1} max={900} defaultValue={cfg.Timeout ?? 3} /></FormField>
          </div>
          <FormField label="Environment variables"><KeyValueEditor name="env" initial={JSON.stringify(cfg.Environment?.Variables ?? {})} /></FormField>
          <FormField label="Layers" description="One layer version ARN per line (see Layers)."><Textarea name="layers" rows={3} defaultValue={(cfg.Layers ?? []).map((l) => l.Arn).join("\n")} /></FormField>
          <KeyValue columns={3} items={[
            { label: "Execution role", value: <Link className="underline-link font-mono text-xs break-all" href={`/iam/roles/${encodeURIComponent(cfg.Role?.split("/").pop() ?? "")}`}>{cfg.Role}</Link> },
            { label: "Package type", value: cfg.PackageType ?? "Zip" },
            { label: "Architecture", value: cfg.Architectures?.join(", ") ?? "x86_64" },
          ]} />
          <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
        </form>
      </Container>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Container header={<Header description="Reserve concurrency for this function; empty uses the unreserved account pool.">Concurrency</Header>}>
          <form action={setConcurrency} className="space-y-3">
            {hidden}
            <FormField label="Reserved concurrency"><Input name="reserved" type="number" min={0} defaultValue={conc?.ReservedConcurrentExecutions ?? ""} placeholder="Use unreserved account concurrency" /></FormField>
            <div className="flex justify-end"><button className={buttonClass("normal")}>Save</button></div>
          </form>
        </Container>
        <Container header={<Header description="Retries and destinations for asynchronous invocations.">Asynchronous invocation</Header>}>
          <form action={saveDestinations} className="space-y-3">
            {hidden}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Retry attempts"><Select name="retries" defaultValue={String(invoke?.MaximumRetryAttempts ?? 2)}>{["0", "1", "2"].map((v) => <option key={v}>{v}</option>)}</Select></FormField>
              <FormField label="Maximum age of event (s)"><Input name="maxAge" type="number" min={60} max={21600} defaultValue={invoke?.MaximumEventAgeInSeconds ?? 21600} /></FormField>
            </div>
            <FormField label="On success destination ARN"><Input name="onSuccess" defaultValue={invoke?.DestinationConfig?.OnSuccess?.Destination ?? ""} placeholder="SQS queue, SNS topic, Lambda function or event bus ARN" /></FormField>
            <FormField label="On failure destination ARN"><Input name="onFailure" defaultValue={invoke?.DestinationConfig?.OnFailure?.Destination ?? ""} /></FormField>
            <div className="flex justify-end"><button className={buttonClass("normal")}>Save</button></div>
          </form>
        </Container>
        <Container header={<Header description="A dedicated HTTPS endpoint for the function.">Function URL</Header>}>
          <form action={setFunctionUrl} className="space-y-3">
            {hidden}
            {url ? (
              <>
                <KeyValue columns={1} items={[
                  { label: "Function URL", value: <span className="font-mono text-xs break-all">{url.FunctionUrl}</span> },
                  { label: "Auth type", value: url.AuthType },
                  { label: "CORS", value: url.Cors?.AllowOrigins?.length ? "Enabled" : "Disabled" },
                ]} />
                <p className="text-xs text-muted">The emulator serves function URLs on an internal port. With the emulator in Docker, only port 9297 is published, so this URL is reachable from inside the container only.</p>
                <input type="hidden" name="remove" value="true" />
                <div className="flex justify-end"><button className={buttonClass("normal")}>Delete function URL</button></div>
              </>
            ) : (
              <>
                <FormField label="Auth type"><Select name="auth" defaultValue="NONE"><option value="NONE">NONE</option><option value="AWS_IAM">AWS_IAM</option></Select></FormField>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cors" className="accent-accent" /> Configure cross-origin resource sharing (CORS)</label>
                <div className="flex justify-end"><button className={buttonClass("normal")}>Create function URL</button></div>
              </>
            )}
          </form>
        </Container>
        <Container
          noPadding
          header={
            <Header
              counter={statements.length}
              description="Resource-based policy statements (who may invoke this function)."
              actions={
                <>
                  <ConfirmAction formId="perm-form" action={removeFunctionPermissions} extra={{ name }} label="Delete" title="Remove policy statements" noun="statement" confirmWord="delete" />
                  <ModalButton label="Add permissions" title="Add resource-based policy statement">
                    <form action={addFunctionPermission} className="space-y-4">
                      {hidden}
                      <FormField label="Statement ID"><Input name="sid" required defaultValue={`allow-${statements.length + 1}`} /></FormField>
                      <FormField label="Principal"><Input name="principal" required defaultValue="sns.amazonaws.com" /></FormField>
                      <FormField label={<>Source ARN <i className="font-normal text-muted">- optional</i></>}><Input name="sourceArn" /></FormField>
                      <FormField label="Action"><Select name="action" defaultValue="lambda:InvokeFunction"><option>lambda:InvokeFunction</option><option>lambda:InvokeFunctionUrl</option><option>lambda:GetFunction</option></Select></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Resource-based policy
            </Header>
          }
        >
          <form id="perm-form" />
          <Table
            formId="perm-form"
            selection="multi"
            rows={statements}
            rowKey={(s) => s.Sid}
            columns={[
              { header: "Statement ID", cell: (s) => s.Sid },
              { header: "Principal", cell: (s) => <span className="font-mono text-xs">{JSON.stringify(s.Principal)}</span> },
              { header: "Action", cell: (s) => s.Action },
              { header: "Conditions", cell: (s) => <span className="font-mono text-xs break-all">{s.Condition ? JSON.stringify(s.Condition) : "-"}</span> },
            ]}
            empty={<EmptyState title="No statements" />}
          />
        </Container>
      </div>
    </>
  );
}

async function AliasesTab({ name }: { name: string }) {
  const { lambda } = await aws();
  const [versions, aliases] = await Promise.all([
    lambda.send(new ListVersionsByFunctionCommand({ FunctionName: name })).then((r) => r.Versions ?? []).catch(() => []),
    lambda.send(new ListAliasesCommand({ FunctionName: name })).then((r) => r.Aliases ?? []).catch(() => []),
  ]);
  const published = versions.filter((v) => v.Version !== "$LATEST");
  const hidden = <input type="hidden" name="name" value={name} />;
  return (
    <>
      <Container
        noPadding
        header={
          <Header
            counter={aliases.length}
            actions={
              <>
                <ConfirmAction formId="alias-form" action={deleteAliases} extra={{ name }} label="Delete" title="Delete aliases" noun="alias" confirmWord="delete" />
                <ModalButton label="Create alias" title="Create alias" variant="primary">
                  <form action={createAlias} className="space-y-4">
                    {hidden}
                    <FormField label="Name"><Input name="alias" required pattern="[A-Za-z0-9_\-]+" defaultValue="live" autoFocus /></FormField>
                    <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                    <FormField label="Version"><Select name="version">{["$LATEST", ...published.map((v) => v.Version!)].map((v) => <option key={v}>{v}</option>)}</Select></FormField>
                    <details className="rounded-lg border border-line p-3">
                      <summary className="cursor-pointer font-bold">Weighted alias</summary>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <FormField label="Additional version"><Select name="weightVersion" defaultValue=""><option value="">None</option>{published.map((v) => <option key={v.Version}>{v.Version}</option>)}</Select></FormField>
                        <FormField label="Weight (%)"><Input name="weight" type="number" min={0} max={99} defaultValue={0} /></FormField>
                      </div>
                    </details>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Aliases
          </Header>
        }
      >
        <form id="alias-form" />
        <Table
          formId="alias-form"
          selection="multi"
          rows={aliases}
          rowKey={(a) => a.Name!}
          columns={[
            { header: "Name", cell: (a) => a.Name },
            { header: "Versions", cell: (a) => <span className="flex flex-wrap gap-1"><Badge color="blue">{a.FunctionVersion}</Badge>{Object.entries(a.RoutingConfig?.AdditionalVersionWeights ?? {}).map(([v, w]) => <Badge key={v}>{v}: {Math.round(w * 100)}%</Badge>)}</span> },
            { header: "Description", cell: (a) => a.Description || "-" },
            { header: "ARN", cell: (a) => <span className="font-mono text-xs break-all">{a.AliasArn}</span> },
          ]}
          empty={<EmptyState title="No aliases" />}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={versions.length}
            actions={
              <ModalButton label="Publish new version" title="Publish new version from $LATEST" variant="primary">
                <form action={publishVersion} className="space-y-4">
                  {hidden}
                  <FormField label={<>Version description <i className="font-normal text-muted">- optional</i></>}><Input name="description" autoFocus /></FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Publish</button></div>
                </form>
              </ModalButton>
            }
          >
            Versions
          </Header>
        }
      >
        <Table
          rows={versions}
          rowKey={(v) => v.Version!}
          columns={[
            { header: "Version", cell: (v) => v.Version, sortValue: (v) => (v.Version === "$LATEST" ? 1e9 : Number(v.Version)) },
            { header: "Aliases", cell: (v) => aliases.filter((a) => a.FunctionVersion === v.Version).map((a) => a.Name).join(", ") || "-" },
            { header: "Description", cell: (v) => v.Description || "-" },
            { header: "Code SHA-256", cell: (v) => <span className="font-mono text-xs break-all">{v.CodeSha256}</span> },
            { header: "Last modified", cell: (v) => formatDate(v.LastModified) },
          ]}
        />
      </Container>
    </>
  );
}

async function TriggersTab({ name }: { name: string }) {
  const { lambda, sqs, kinesis, dynamodb } = await aws();
  const [mappings, sources] = await Promise.all([
    lambda.send(new ListEventSourceMappingsCommand({ FunctionName: name })).then((r) => r.EventSourceMappings ?? []).catch(() => []),
    (async () => {
      const out: { arn: string; label: string }[] = [];
      try {
        for (const url of (await sqs.send(new ListQueuesCommand({}))).QueueUrls ?? []) {
          const arn = (await sqs.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ["QueueArn"] }))).Attributes?.QueueArn;
          if (arn) out.push({ arn, label: `SQS: ${url.split("/").pop()}` });
        }
      } catch {}
      try {
        for (const s of (await kinesis.send(new ListStreamsCommand({}))).StreamNames ?? []) {
          const arn = (await kinesis.send(new DescribeStreamSummaryCommand({ StreamName: s }))).StreamDescriptionSummary?.StreamARN;
          if (arn) out.push({ arn, label: `Kinesis: ${s}` });
        }
      } catch {}
      try {
        for (const t of (await dynamodb.send(new ListTablesCommand({}))).TableNames ?? []) {
          const arn = (await dynamodb.send(new DescribeTableCommand({ TableName: t }))).Table?.LatestStreamArn;
          if (arn) out.push({ arn, label: `DynamoDB stream: ${t}` });
        }
      } catch {}
      return out;
    })(),
  ]);
  const hidden = <input type="hidden" name="name" value={name} />;
  return (
    <Container
      noPadding
      header={
        <Header
          counter={mappings.length}
          description="Event source mappings poll SQS queues, Kinesis streams and DynamoDB streams and invoke the function with batches of records."
          actions={
            <>
              <ConfirmAction formId="esm-form" action={toggleTriggers} extra={{ name, enable: "false" }} label="Disable" title="Disable triggers" noun="trigger" confirmWord="disable" confirmLabel="Disable" />
              <ConfirmAction formId="esm-form" action={toggleTriggers} extra={{ name, enable: "true" }} label="Enable" title="Enable triggers" noun="trigger" confirmWord="enable" confirmLabel="Enable" />
              <ConfirmAction formId="esm-form" action={deleteTriggers} extra={{ name }} label="Delete" title="Delete triggers" noun="trigger" confirmWord="delete" />
              <ModalButton label="Add trigger" title="Add trigger" variant="primary">
                <form action={createTrigger} className="space-y-4">
                  {hidden}
                  <FormField label="Source">{sources.length ? <Select name="source">{sources.map((s) => <option key={s.arn} value={s.arn}>{s.label}</option>)}</Select> : <Input name="source" required placeholder="arn:aws:sqs:…" />}</FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Batch size"><Input name="batch" type="number" min={1} max={10000} defaultValue={10} /></FormField>
                    <FormField label="Starting position (streams)"><Select name="position" defaultValue="LATEST"><option>LATEST</option><option>TRIM_HORIZON</option></Select></FormField>
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked className="accent-accent" /> Activate trigger</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="grant" defaultChecked className="accent-accent" /> Add the required permissions to the execution role</label>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Add</button></div>
                </form>
              </ModalButton>
            </>
          }
        >
          Triggers
        </Header>
      }
    >
      <form id="esm-form" />
      <Table
        formId="esm-form"
        selection="multi"
        rows={mappings}
        rowKey={(m) => m.UUID!}
        columns={[
          { header: "Source", cell: (m) => <span className="font-mono text-xs break-all">{m.EventSourceArn}</span> },
          { header: "State", cell: (m) => (m.State === "Enabled" ? <StatusIndicator type="success">Enabled</StatusIndicator> : <StatusIndicator type={m.State === "Disabled" ? "stopped" : "pending"}>{m.State ?? "-"}</StatusIndicator>) },
          { header: "Batch size", cell: (m) => m.BatchSize },
          { header: "Last result", cell: (m) => m.LastProcessingResult ?? "-" },
          { header: "UUID", cell: (m) => <span className="font-mono text-xs">{m.UUID}</span> },
        ]}
        empty={<EmptyState title="No triggers" />}
      />
    </Container>
  );
}
