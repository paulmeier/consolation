import { GetApiCommand, GetIntegrationsCommand, GetRoutesCommand, GetStagesCommand } from "@aws-sdk/client-apigatewayv2";
import { ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { aws, errorMessage, REGION } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, buttonClass } from "@/components/ui";
import { createIntegration, createRoute, createV2Stage, deleteApis, deleteIntegrations, deleteRoutes, deleteV2Stages } from "../../actions";
import { StageCaller } from "../../testers";

export default async function V2ApiPage({ params, searchParams }: PageProps<"/apigateway/v2/[id]">) {
  const id = (await params).id;
  const tab = String((await searchParams).tab ?? "routes");
  const { apigw2, lambda } = await aws();
  let data;
  try {
    data = await Promise.all([
      apigw2.send(new GetApiCommand({ ApiId: id })),
      apigw2.send(new GetRoutesCommand({ ApiId: id, MaxResults: "500" })).catch(() => ({ Items: [] })),
      apigw2.send(new GetIntegrationsCommand({ ApiId: id, MaxResults: "500" })).catch(() => ({ Items: [] })),
      apigw2.send(new GetStagesCommand({ ApiId: id, MaxResults: "500" })).catch(() => ({ Items: [] })),
      lambda.send(new ListFunctionsCommand({})).then((r) => (r.Functions ?? []).map((f) => f.FunctionArn!)).catch(() => [] as string[]),
    ]);
  } catch (e) {
    return (<Page><Header variant="h1">{id}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const [api, routes, integrations, stages, functions] = data;
  const ws = api.ProtocolType === "WEBSOCKET";
  const base = `/apigateway/v2/${id}`;
  const hidden = <input type="hidden" name="api" value={id} />;
  const integ = integrations.Items ?? [];
  const integLabel = (target?: string) => {
    const i = integ.find((x) => `integrations/${x.IntegrationId}` === target);
    return i ? `${i.IntegrationType} ${i.IntegrationUri ?? ""}` : (target ?? "-");
  };
  const endpoint = ws ? `wss://${id}.execute-api.${REGION}.amazonaws.com` : `https://${id}.execute-api.${REGION}.amazonaws.com`;
  return (
    <Page wide>
      <Header variant="h1" info actions={<ConfirmAction values={[`${api.ProtocolType}|${id}`]} extra={{ from: "detail" }} action={deleteApis} label="Delete" title="Delete API" noun="API" confirmWord="confirm" />}>
        {api.Name}
      </Header>
      <Container header={<Header>API details</Header>}>
        <KeyValue items={[
          { label: "API ID", value: <span className="font-mono text-[13px]">{id}</span> },
          { label: "Protocol", value: api.ProtocolType },
          { label: "API endpoint", value: <span className="font-mono text-xs break-all">{endpoint}</span> },
          { label: "Description", value: api.Description || "-" },
          { label: "Created", value: formatDate(api.CreatedDate) },
          ...(ws ? [{ label: "Route selection expression", value: api.RouteSelectionExpression ?? "-" }] : []),
        ]} />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "routes", label: "Routes" }, { id: "integrations", label: "Integrations" }, { id: "stages", label: "Stages" }]} />
      {tab === "routes" && (
        <Container
          noPadding
          header={
            <Header
              counter={routes.Items?.length ?? 0}
              actions={
                <>
                  <ConfirmAction formId="routes-form" action={deleteRoutes} extra={{ api: id }} label="Delete" title="Delete route" noun="route" confirmWord="delete" />
                  <ModalButton label="Create route" title="Create route" variant="primary">
                    <form action={createRoute} className="space-y-4">
                      {hidden}
                      <FormField label="Route key" description={ws ? "$connect, $disconnect, $default, or a custom action name." : "METHOD /path, for example GET /items/{id}, or $default."}>
                        <Input name="routeKey" required defaultValue={ws ? "$default" : "GET /hello"} autoFocus />
                      </FormField>
                      <FormField label="Integration"><Select name="integration" defaultValue=""><option value="">None (attach later)</option>{integ.map((i) => <option key={i.IntegrationId} value={i.IntegrationId}>{i.IntegrationType} {i.IntegrationUri}</option>)}</Select></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Routes
            </Header>
          }
        >
          <form id="routes-form" />
          <Table
            formId="routes-form"
            selection="multi"
            rows={routes.Items ?? []}
            rowKey={(r) => r.RouteId!}
            columns={[
              { header: "Route", cell: (r) => <span className="font-mono text-[13px]">{r.RouteKey}</span> },
              { header: "Integration", cell: (r) => <span className="text-xs break-all">{integLabel(r.Target)}</span> },
              { header: "Authorization", cell: (r) => r.AuthorizationType ?? "NONE" },
              { header: "Route ID", cell: (r) => <span className="font-mono text-xs">{r.RouteId}</span> },
            ]}
            empty={<EmptyState title="No routes" />}
          />
        </Container>
      )}
      {tab === "integrations" && (
        <Container
          noPadding
          header={
            <Header
              counter={integ.length}
              actions={
                <>
                  <ConfirmAction formId="int-form" action={deleteIntegrations} extra={{ api: id }} label="Delete" title="Delete integration" noun="integration" confirmWord="delete" />
                  <ModalButton label="Create integration" title="Create integration" variant="primary">
                    <form action={createIntegration} className="space-y-4">
                      {hidden}
                      <FormField label="Integration type"><Select name="type" defaultValue="AWS_PROXY"><option value="AWS_PROXY">Lambda function</option><option value="HTTP_PROXY">HTTP URI</option>{ws && <option value="MOCK">Mock</option>}</Select></FormField>
                      <FormField label="Lambda function ARN or URL">
                        <Input name="target" list="fn-list2" placeholder="arn:aws:lambda:… or https://…" />
                        <datalist id="fn-list2">{functions.map((f) => <option key={f} value={f} />)}</datalist>
                      </FormField>
                      <FormField label="HTTP method (HTTP URI)"><Select name="method" defaultValue="ANY">{["ANY", "GET", "POST", "PUT", "DELETE"].map((m) => <option key={m}>{m}</option>)}</Select></FormField>
                      {!ws && <FormField label="Payload format version (Lambda)"><Select name="payload" defaultValue="2.0"><option>2.0</option><option>1.0</option></Select></FormField>}
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Integrations
            </Header>
          }
        >
          <form id="int-form" />
          <Table
            formId="int-form"
            selection="multi"
            rows={integ}
            rowKey={(i) => i.IntegrationId!}
            columns={[
              { header: "Integration ID", cell: (i) => <span className="font-mono text-xs">{i.IntegrationId}</span> },
              { header: "Type", cell: (i) => i.IntegrationType },
              { header: "Target", cell: (i) => <span className="font-mono text-xs break-all">{i.IntegrationUri ?? "-"}</span> },
              { header: "Method", cell: (i) => i.IntegrationMethod ?? "-" },
              { header: "Payload format", cell: (i) => i.PayloadFormatVersion ?? "-" },
            ]}
            empty={<EmptyState title="No integrations" />}
          />
        </Container>
      )}
      {tab === "stages" && (
        <>
          <Container
            noPadding
            header={
              <Header
                counter={stages.Items?.length ?? 0}
                actions={
                  <>
                    <ConfirmAction formId="v2stages-form" action={deleteV2Stages} extra={{ api: id }} label="Delete" title="Delete stage" noun="stage" confirmWord="delete" />
                    <ModalButton label="Create stage" title="Create stage" variant="primary">
                      <form action={createV2Stage} className="space-y-4">
                        {hidden}
                        <FormField label="Stage name" description={ws ? undefined : "$default serves the API at the root of the invoke URL."}><Input name="stage" required defaultValue={ws ? "production" : "$default"} autoFocus /></FormField>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoDeploy" defaultChecked className="accent-accent" /> Enable automatic deployment</label>
                        <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                      </form>
                    </ModalButton>
                  </>
                }
              >
                Stages
              </Header>
            }
          >
            <form id="v2stages-form" />
            <Table
              formId="v2stages-form"
              selection="multi"
              rows={stages.Items ?? []}
              rowKey={(s) => s.StageName!}
              columns={[
                { header: "Stage", cell: (s) => s.StageName },
                { header: "Invoke URL", cell: (s) => <span className="font-mono text-xs break-all">{endpoint}{s.StageName === "$default" ? "" : `/${s.StageName}`}</span> },
                { header: "Auto-deploy", cell: (s) => (s.AutoDeploy ? "Enabled" : "Disabled") },
                { header: "Last updated", cell: (s) => formatDate(s.LastUpdatedDate) },
              ]}
              empty={<EmptyState title="No stages" />}
            />
          </Container>
          {!ws && (
            <Container header={<Header description="Sends a real request to the stage through the emulator.">Call the invoke URL</Header>}>
              <StageCaller api={id} stages={(stages.Items ?? []).map((s) => s.StageName!)} />
            </Container>
          )}
        </>
      )}
    </Page>
  );
}
