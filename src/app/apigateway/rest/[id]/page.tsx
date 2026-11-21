import Link from "next/link";
import { GetAuthorizersCommand, GetResourcesCommand, GetRestApiCommand, GetStagesCommand, type Resource } from "@aws-sdk/client-api-gateway";
import { ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { aws, errorMessage, REGION } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, Textarea, buttonClass, cx } from "@/components/ui";
import { createMethod, createResource, createRestAuthorizer, deleteApis, deleteMethod, deleteResources, deleteRestAuthorizers, deleteRestStages, deployRest } from "../../actions";
import { MethodTester, StageCaller } from "../../testers";

const METHODS = ["ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export default async function RestApiPage({ params, searchParams }: PageProps<"/apigateway/rest/[id]">) {
  const id = (await params).id;
  const sp = await searchParams;
  const tab = String(sp.tab ?? "resources");
  const selRes = typeof sp.resource === "string" ? sp.resource : undefined;
  const selMethod = typeof sp.method === "string" ? sp.method : undefined;
  const { apigw, lambda } = await aws();
  let data;
  try {
    data = await Promise.all([
      apigw.send(new GetRestApiCommand({ restApiId: id })),
      apigw.send(new GetResourcesCommand({ restApiId: id, limit: 500, embed: ["methods"] })),
      apigw.send(new GetStagesCommand({ restApiId: id })).catch(() => ({ item: [] })),
      apigw.send(new GetAuthorizersCommand({ restApiId: id })).catch(() => ({ items: [] })),
      lambda.send(new ListFunctionsCommand({})).then((r) => (r.Functions ?? []).map((f) => f.FunctionArn!)).catch(() => [] as string[]),
    ]);
  } catch (e) {
    return (<Page><Header variant="h1">{id}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const [api, resRes, stagesRes, authRes, functions] = data;
  const resources = [...(resRes.items ?? [])].sort((a, b) => (a.path ?? "").localeCompare(b.path ?? ""));
  const stages = stagesRes.item ?? [];
  const base = `/apigateway/rest/${id}`;
  const hidden = <input type="hidden" name="api" value={id} />;
  const current: Resource | undefined = resources.find((r) => r.id === selRes) ?? resources[0];
  const method = selMethod && current?.resourceMethods?.[selMethod];
  const depth = (p?: string) => (p === "/" ? 0 : (p ?? "").split("/").length - 1);
  return (
    <Page wide>
      <Header
        variant="h1"
        info
        actions={
          <>
            <ConfirmAction values={[`REST|${id}`]} extra={{ from: "detail" }} action={deleteApis} label="Delete API" title="Delete API" noun="API" confirmWord="confirm" />
            <ModalButton label="Deploy API" title="Deploy API" variant="primary">
              <form action={deployRest} className="space-y-4">
                {hidden}
                <FormField label="Stage" description="Existing or new stage name."><Input name="stage" required defaultValue={stages[0]?.stageName ?? "dev"} pattern="[A-Za-z0-9_\-]+" /></FormField>
                <FormField label={<>Deployment description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Deploy</button></div>
              </form>
            </ModalButton>
          </>
        }
      >
        {api.name}
      </Header>
      <Container header={<Header>API details</Header>}>
        <KeyValue items={[
          { label: "API ID", value: <span className="font-mono text-[13px]">{id}</span> },
          { label: "Description", value: api.description || "-" },
          { label: "Endpoint type", value: api.endpointConfiguration?.types?.join(", ") ?? "REGIONAL" },
          { label: "Created", value: formatDate(api.createdDate) },
          { label: "API key source", value: api.apiKeySource ?? "HEADER" },
          { label: "Stages", value: stages.length },
        ]} />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "resources", label: "Resources" }, { id: "stages", label: "Stages" }, { id: "authorizers", label: "Authorizers" }]} />
      {tab === "resources" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
          <Container
            noPadding
            header={
              <Header
                actions={
                  <>
                    <ConfirmAction formId="res-form" action={deleteResources} extra={{ api: id }} label="Delete" title="Delete resource" noun="resource" confirmWord="delete" description="Child resources and their methods are deleted too." />
                    <ModalButton label="Create resource" title="Create resource" variant="primary">
                      <form action={createResource} className="space-y-4">
                        {hidden}
                        <FormField label="Resource path (parent)"><Select name="parent" defaultValue={current?.id}>{resources.map((r) => <option key={r.id} value={r.id}>{r.path}</option>)}</Select></FormField>
                        <FormField label="Resource name" description="Use {name} for a path parameter or {proxy+} for a greedy proxy."><Input name="pathPart" required placeholder="items" autoFocus /></FormField>
                        <div className="flex justify-end"><button className={buttonClass("primary")}>Create resource</button></div>
                      </form>
                    </ModalButton>
                  </>
                }
              >
                Resources
              </Header>
            }
          >
            <form id="res-form" />
            <ul className="pb-3">
              {resources.map((r) => (
                <li key={r.id}>
                  <div className={cx("flex items-center gap-2 px-5 py-1", r.id === current?.id && "bg-accent-soft")} style={{ paddingLeft: 20 + depth(r.path) * 16 }}>
                    {r.path !== "/" && <input type="checkbox" name="selected" value={r.id} form="res-form" data-select aria-label={`Select ${r.path}`} className="accent-accent" />}
                    <Link href={`${base}?resource=${r.id}`} className="font-mono text-[13px] hover:text-accent">{r.path === "/" ? "/" : `/${r.pathPart}`}</Link>
                  </div>
                  {Object.keys(r.resourceMethods ?? {}).map((m) => (
                    <Link key={m} href={`${base}?resource=${r.id}&method=${m}`} className={cx("block py-0.5 text-xs font-bold hover:text-accent", r.id === current?.id && m === selMethod ? "text-accent" : "text-muted")} style={{ paddingLeft: 44 + depth(r.path) * 16 }}>
                      {m}
                    </Link>
                  ))}
                </li>
              ))}
            </ul>
          </Container>
          <div className="space-y-5">
            {current && (
              <Container
                header={
                  <Header
                    description={<span className="font-mono">{current.path}</span>}
                    actions={
                      <ModalButton label="Create method" title={`Create method on ${current.path}`} variant="primary" size="lg">
                        <form action={createMethod} className="space-y-4">
                          {hidden}
                          <input type="hidden" name="resource" value={current.id} />
                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Method type"><Select name="method" defaultValue="GET">{METHODS.filter((m) => !current.resourceMethods?.[m]).map((m) => <option key={m}>{m}</option>)}</Select></FormField>
                            <FormField label="Integration type">
                              <Select name="integration" defaultValue="MOCK">
                                <option value="MOCK">Mock</option>
                                <option value="AWS_PROXY">Lambda function (proxy)</option>
                                <option value="HTTP_PROXY">HTTP (proxy)</option>
                                <option value="HTTP">HTTP</option>
                              </Select>
                            </FormField>
                          </div>
                          <FormField label="Lambda function ARN or HTTP endpoint URL" description="Not needed for Mock.">
                            {functions.length ? (
                              <><Input name="target" list="fn-list" placeholder="arn:aws:lambda:… or https://…" /><datalist id="fn-list">{functions.map((f) => <option key={f} value={f} />)}</datalist></>
                            ) : (
                              <Input name="target" placeholder="https://example.test" />
                            )}
                          </FormField>
                          <FormField label="Mock response body (Mock only)"><Textarea name="mockBody" rows={3} defaultValue={'{"message": "Hello from a mock integration"}'} /></FormField>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Authorization"><Select name="auth" defaultValue="NONE"><option value="NONE">None</option><option value="AWS_IAM">AWS IAM</option><option value="CUSTOM">Custom (Lambda authorizer)</option></Select></FormField>
                            <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" name="apiKey" className="accent-accent" /> API key required</label>
                          </div>
                          <div className="flex justify-end"><button className={buttonClass("primary")}>Create method</button></div>
                        </form>
                      </ModalButton>
                    }
                  >
                    Resource details
                  </Header>
                }
              >
                <KeyValue items={[
                  { label: "Resource ID", value: <span className="font-mono text-[13px]">{current.id}</span> },
                  { label: "Path", value: <span className="font-mono">{current.path}</span> },
                  { label: "Methods", value: <span className="flex flex-wrap gap-1">{Object.keys(current.resourceMethods ?? {}).map((m) => <Badge key={m}>{m}</Badge>)}{!Object.keys(current.resourceMethods ?? {}).length && "None"}</span> },
                ]} />
              </Container>
            )}
            {current && method && selMethod && (
              <Container
                header={
                  <Header
                    actions={
                      <form action={deleteMethod}>
                        {hidden}
                        <input type="hidden" name="resource" value={current.id} />
                        <input type="hidden" name="method" value={selMethod} />
                        <button className={buttonClass("normal")}>Delete method</button>
                      </form>
                    }
                  >
                    {selMethod} {current.path}
                  </Header>
                }
              >
                <KeyValue items={[
                  { label: "Authorization", value: method.authorizationType ?? "NONE" },
                  { label: "API key required", value: method.apiKeyRequired ? "True" : "False" },
                  { label: "Integration type", value: method.methodIntegration?.type ?? "-" },
                  { label: "Integration URI", value: <span className="font-mono text-xs break-all">{method.methodIntegration?.uri ?? "-"}</span> },
                ]} />
                <div className="mt-5 border-t border-line pt-4">
                  <h3 className="mb-2 font-bold">Test</h3>
                  <MethodTester api={id} resource={current.id!} method={selMethod} path={current.path!.replace(/\{[^}]+\}/g, "example")} />
                </div>
              </Container>
            )}
          </div>
        </div>
      )}
      {tab === "stages" && (
        <>
          <Container
            noPadding
            header={<Header counter={stages.length} actions={<ConfirmAction formId="stages-form" action={deleteRestStages} extra={{ api: id }} label="Delete stage" title="Delete stage" noun="stage" confirmWord="delete" />}>Stages</Header>}
          >
            <form id="stages-form" />
            <Table
              formId="stages-form"
              selection="multi"
              rows={stages}
              rowKey={(s) => s.stageName!}
              columns={[
                { header: "Stage", cell: (s) => s.stageName },
                { header: "Invoke URL", cell: (s) => <span className="font-mono text-xs break-all">https://{id}.execute-api.{REGION}.amazonaws.com/{s.stageName}</span> },
                { header: "Deployment", cell: (s) => <span className="font-mono text-xs">{s.deploymentId}</span> },
                { header: "Last updated", cell: (s) => formatDate(s.lastUpdatedDate) },
              ]}
              empty={<EmptyState title="No stages" description="Deploy the API to create a stage." />}
            />
          </Container>
          <Container header={<Header description="Sends a real request to the deployed stage. The emulator routes it by the execute-api Host header.">Call the invoke URL</Header>}>
            <StageCaller api={id} stages={stages.map((s) => s.stageName!)} />
          </Container>
        </>
      )}
      {tab === "authorizers" && (
        <Container
          noPadding
          header={
            <Header
              counter={authRes.items?.length ?? 0}
              actions={
                <>
                  <ConfirmAction formId="auth-form" action={deleteRestAuthorizers} extra={{ api: id }} label="Delete" title="Delete authorizer" noun="authorizer" confirmWord="delete" />
                  <ModalButton label="Create authorizer" title="Create Lambda (token) authorizer" variant="primary">
                    <form action={createRestAuthorizer} className="space-y-4">
                      {hidden}
                      <FormField label="Authorizer name"><Input name="name" required autoFocus /></FormField>
                      <FormField label="Lambda function ARN"><Select name="lambda">{functions.map((f) => <option key={f}>{f}</option>)}</Select></FormField>
                      <FormField label="Token source"><Input name="source" defaultValue="method.request.header.Authorization" /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!functions.length}>Create authorizer</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Authorizers
            </Header>
          }
        >
          <form id="auth-form" />
          <Table
            formId="auth-form"
            selection="multi"
            rows={authRes.items ?? []}
            rowKey={(a) => a.id!}
            columns={[
              { header: "Name", cell: (a) => a.name },
              { header: "Type", cell: (a) => a.type },
              { header: "Identity source", cell: (a) => a.identitySource ?? "-" },
              { header: "Authorizer URI", cell: (a) => <span className="font-mono text-xs break-all">{a.authorizerUri ?? "-"}</span> },
            ]}
            empty={<EmptyState title="No authorizers" />}
          />
        </Container>
      )}
    </Page>
  );
}
