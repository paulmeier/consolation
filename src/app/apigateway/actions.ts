"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  CreateApiKeyCommand,
  CreateAuthorizerCommand as CreateRestAuthorizerCommand,
  CreateDeploymentCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  CreateUsagePlanCommand,
  CreateUsagePlanKeyCommand,
  DeleteApiKeyCommand,
  DeleteAuthorizerCommand as DeleteRestAuthorizerCommand,
  DeleteMethodCommand,
  DeleteResourceCommand,
  DeleteRestApiCommand,
  DeleteStageCommand as DeleteRestStageCommand,
  DeleteUsagePlanCommand,
  PutIntegrationCommand,
  PutIntegrationResponseCommand,
  PutMethodCommand,
  PutMethodResponseCommand,
  TestInvokeMethodCommand,
  type IntegrationType,
} from "@aws-sdk/client-api-gateway";
import {
  CreateApiCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
  DeleteApiCommand,
  DeleteIntegrationCommand,
  DeleteRouteCommand,
  DeleteStageCommand,
  type IntegrationType as V2IntegrationType,
  type ProtocolType,
} from "@aws-sdk/client-apigatewayv2";
import { AddPermissionCommand } from "@aws-sdk/client-lambda";
import { aws, errorMessage, REGION, type Clients } from "@/lib/emulator";
import { invokeExecuteApi } from "@/lib/fetch-emulator";
import { flash } from "@/lib/flash";

const restPath = (id: string) => `/apigateway/rest/${id}`;
const v2Path = (id: string) => `/apigateway/v2/${id}`;
const lambdaUri = (fnArn: string) => `arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${fnArn}/invocations`;

async function guard(ok: string, paths: string[], fn: () => Promise<unknown>) {
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    await flash("error", errorMessage(e));
  }
  paths.forEach((p) => revalidatePath(p));
}

/** Let API Gateway invoke a Lambda function (the console adds this permission for you). */
async function allowInvoke(lambda: Clients["lambda"], fnArn: string, apiId: string) {
  try {
    await lambda.send(
      new AddPermissionCommand({ FunctionName: fnArn, StatementId: `apigateway-${apiId}-${Date.now()}`, Action: "lambda:InvokeFunction", Principal: "apigateway.amazonaws.com", SourceArn: `arn:aws:execute-api:${REGION}:000000000000:${apiId}/*` }),
    );
  } catch {
    /* permission is best effort; the emulator does not enforce it */
  }
}

export async function createApi(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const type = String(fd.get("type"));
  let target = "";
  try {
    const { apigw, apigw2 } = await aws();
    if (type === "REST") {
      const r = await apigw.send(new CreateRestApiCommand({ name, description: String(fd.get("description") ?? "") || undefined, endpointConfiguration: { types: ["REGIONAL"] } }));
      target = restPath(r.id!);
    } else {
      const r = await apigw2.send(
        new CreateApiCommand({
          Name: name,
          ProtocolType: type as ProtocolType,
          Description: String(fd.get("description") ?? "") || undefined,
          ...(type === "WEBSOCKET" ? { RouteSelectionExpression: "$request.body.action" } : {}),
        }),
      );
      target = v2Path(r.ApiId!);
    }
  } catch (e) {
    await flash("error", `Failed to create API ${name}. ${errorMessage(e)}`);
    revalidatePath("/apigateway/apis");
    return;
  }
  await flash("success", `Successfully created API ${name}.`);
  redirect(target);
}

export async function deleteApis(fd: FormData) {
  const { apigw, apigw2 } = await aws();
  for (const v of fd.getAll("selected").map(String)) {
    const [kind, id] = v.split("|");
    await guard(`Deleted API ${id}.`, ["/apigateway/apis"], () => (kind === "REST" ? apigw.send(new DeleteRestApiCommand({ restApiId: id })) : apigw2.send(new DeleteApiCommand({ ApiId: id }))));
  }
  if (fd.get("from") === "detail") redirect("/apigateway/apis");
}

// ---------- REST APIs

export async function createResource(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw } = await aws();
  await guard("Resource created.", [restPath(api)], () => apigw.send(new CreateResourceCommand({ restApiId: api, parentId: String(fd.get("parent")), pathPart: String(fd.get("pathPart")).replace(/^\/+/, "") })));
}

export async function deleteResources(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw } = await aws();
  for (const id of fd.getAll("selected").map(String)) await guard("Resource deleted.", [restPath(api)], () => apigw.send(new DeleteResourceCommand({ restApiId: api, resourceId: id })));
}

export async function createMethod(fd: FormData) {
  const api = String(fd.get("api"));
  const resource = String(fd.get("resource"));
  const method = String(fd.get("method"));
  const type = String(fd.get("integration"));
  const { apigw, lambda } = await aws();
  await guard(`${method} method created.`, [restPath(api)], async () => {
    await apigw.send(new PutMethodCommand({ restApiId: api, resourceId: resource, httpMethod: method, authorizationType: String(fd.get("auth") || "NONE"), apiKeyRequired: fd.get("apiKey") === "on" }));
    const target = String(fd.get("target") ?? "").trim();
    if (type === "MOCK") {
      const body = String(fd.get("mockBody") || '{"message": "Hello from a mock integration"}');
      await apigw.send(new PutIntegrationCommand({ restApiId: api, resourceId: resource, httpMethod: method, type: "MOCK", requestTemplates: { "application/json": '{"statusCode": 200}' } }));
      await apigw.send(new PutMethodResponseCommand({ restApiId: api, resourceId: resource, httpMethod: method, statusCode: "200" }));
      await apigw.send(new PutIntegrationResponseCommand({ restApiId: api, resourceId: resource, httpMethod: method, statusCode: "200", responseTemplates: { "application/json": body } }));
    } else if (type === "AWS_PROXY") {
      await apigw.send(new PutIntegrationCommand({ restApiId: api, resourceId: resource, httpMethod: method, type: "AWS_PROXY", integrationHttpMethod: "POST", uri: lambdaUri(target) }));
      await allowInvoke(lambda, target, api);
    } else {
      await apigw.send(new PutIntegrationCommand({ restApiId: api, resourceId: resource, httpMethod: method, type: type as IntegrationType, integrationHttpMethod: method === "ANY" ? "ANY" : method, uri: target }));
      if (type === "HTTP") {
        await apigw.send(new PutMethodResponseCommand({ restApiId: api, resourceId: resource, httpMethod: method, statusCode: "200" }));
        await apigw.send(new PutIntegrationResponseCommand({ restApiId: api, resourceId: resource, httpMethod: method, statusCode: "200" }));
      }
    }
  });
}

export async function deleteMethod(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw } = await aws();
  await guard("Method deleted.", [restPath(api)], () => apigw.send(new DeleteMethodCommand({ restApiId: api, resourceId: String(fd.get("resource")), httpMethod: String(fd.get("method")) })));
}

export async function deployRest(fd: FormData) {
  const api = String(fd.get("api"));
  const stage = String(fd.get("stage") ?? "").trim();
  const { apigw } = await aws();
  await guard(`Deployed to stage ${stage}.`, [restPath(api)], () => apigw.send(new CreateDeploymentCommand({ restApiId: api, stageName: stage, description: String(fd.get("description") ?? "") || undefined })));
}

export async function deleteRestStages(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw } = await aws();
  for (const s of fd.getAll("selected").map(String)) await guard(`Stage ${s} deleted.`, [restPath(api)], () => apigw.send(new DeleteRestStageCommand({ restApiId: api, stageName: s })));
}

export async function createRestAuthorizer(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw, lambda } = await aws();
  await guard("Authorizer created.", [restPath(api)], async () => {
    const fn = String(fd.get("lambda"));
    await apigw.send(new CreateRestAuthorizerCommand({ restApiId: api, name: String(fd.get("name")), type: "TOKEN", authorizerUri: lambdaUri(fn), identitySource: String(fd.get("source") || "method.request.header.Authorization") }));
    await allowInvoke(lambda, fn, api);
  });
}

export async function deleteRestAuthorizers(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw } = await aws();
  for (const a of fd.getAll("selected").map(String)) await guard("Authorizer deleted.", [restPath(api)], () => apigw.send(new DeleteRestAuthorizerCommand({ restApiId: api, authorizerId: a })));
}

export type TestResult = { status?: number; body?: string; latency?: number; log?: string; headers?: Record<string, string>; error?: string } | null;

export async function testInvoke(_p: TestResult, fd: FormData): Promise<TestResult> {
  try {
    const { apigw } = await aws();
    const r = await apigw.send(
      new TestInvokeMethodCommand({
        restApiId: String(fd.get("api")),
        resourceId: String(fd.get("resource")),
        httpMethod: String(fd.get("method")),
        pathWithQueryString: String(fd.get("path") || "/"),
        body: String(fd.get("body") ?? "") || undefined,
      }),
    );
    return { status: r.status, body: r.body, latency: r.latency, log: r.log, headers: r.headers };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Calls a deployed stage through the emulator's execute-api routing. */
export async function callStage(_p: TestResult, fd: FormData): Promise<TestResult> {
  try {
    const stage = String(fd.get("stage"));
    let path = String(fd.get("path") || "/");
    if (!path.startsWith("/")) path = `/${path}`;
    const full = stage === "$default" ? path : `/${stage}${path}`;
    const key = String(fd.get("apiKey") ?? "").trim();
    const r = await invokeExecuteApi({ apiId: String(fd.get("api")), region: REGION, method: String(fd.get("method") || "GET"), path: full, body: String(fd.get("body") ?? "") || undefined, headers: key ? { "x-api-key": key } : undefined });
    return { status: r.status, body: r.body, latency: r.ms, headers: r.headers };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// ---------- API keys and usage plans

export async function createApiKey(fd: FormData) {
  const { apigw } = await aws();
  await guard("API key created.", ["/apigateway/api-keys"], () => apigw.send(new CreateApiKeyCommand({ name: String(fd.get("name")), enabled: true, ...(String(fd.get("value") ?? "") ? { value: String(fd.get("value")) } : {}) })));
}

export async function deleteApiKeys(fd: FormData) {
  const { apigw } = await aws();
  for (const k of fd.getAll("selected").map(String)) await guard("API key deleted.", ["/apigateway/api-keys"], () => apigw.send(new DeleteApiKeyCommand({ apiKey: k })));
}

export async function createUsagePlan(fd: FormData) {
  const { apigw } = await aws();
  await guard("Usage plan created.", ["/apigateway/api-keys"], async () => {
    const stage = String(fd.get("stage") ?? "");
    const [apiId, stageName] = stage.split("|");
    const plan = await apigw.send(
      new CreateUsagePlanCommand({
        name: String(fd.get("name")),
        throttle: { rateLimit: Number(fd.get("rate") || 10), burstLimit: Number(fd.get("burst") || 20) },
        quota: Number(fd.get("quota") || 0) ? { limit: Number(fd.get("quota")), period: "DAY" } : undefined,
        apiStages: apiId ? [{ apiId, stage: stageName }] : undefined,
      }),
    );
    const key = String(fd.get("key") ?? "");
    if (key) await apigw.send(new CreateUsagePlanKeyCommand({ usagePlanId: plan.id, keyId: key, keyType: "API_KEY" }));
  });
}

export async function deleteUsagePlans(fd: FormData) {
  const { apigw } = await aws();
  for (const p of fd.getAll("selected").map(String)) await guard("Usage plan deleted.", ["/apigateway/api-keys"], () => apigw.send(new DeleteUsagePlanCommand({ usagePlanId: p })));
}

// ---------- HTTP and WebSocket APIs

export async function createIntegration(fd: FormData) {
  const api = String(fd.get("api"));
  const type = String(fd.get("type")) as V2IntegrationType;
  const target = String(fd.get("target") ?? "").trim();
  const { apigw2, lambda } = await aws();
  await guard("Integration created.", [v2Path(api)], async () => {
    await apigw2.send(
      new CreateIntegrationCommand({
        ApiId: api,
        IntegrationType: type,
        IntegrationUri: type === "AWS_PROXY" ? target : target,
        ...(type === "AWS_PROXY" ? { PayloadFormatVersion: String(fd.get("payload") || "2.0") } : {}),
        ...(type === "HTTP_PROXY" ? { IntegrationMethod: String(fd.get("method") || "ANY") } : {}),
        ...(type === "MOCK" ? {} : {}),
      }),
    );
    if (type === "AWS_PROXY") await allowInvoke(lambda, target, api);
  });
}

export async function deleteIntegrations(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw2 } = await aws();
  for (const i of fd.getAll("selected").map(String)) await guard("Integration deleted.", [v2Path(api)], () => apigw2.send(new DeleteIntegrationCommand({ ApiId: api, IntegrationId: i })));
}

export async function createRoute(fd: FormData) {
  const api = String(fd.get("api"));
  const integration = String(fd.get("integration") ?? "");
  const { apigw2 } = await aws();
  await guard("Route created.", [v2Path(api)], () => apigw2.send(new CreateRouteCommand({ ApiId: api, RouteKey: String(fd.get("routeKey")).trim(), ...(integration ? { Target: `integrations/${integration}` } : {}) })));
}

export async function deleteRoutes(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw2 } = await aws();
  for (const r of fd.getAll("selected").map(String)) await guard("Route deleted.", [v2Path(api)], () => apigw2.send(new DeleteRouteCommand({ ApiId: api, RouteId: r })));
}

export async function createV2Stage(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw2 } = await aws();
  await guard("Stage created.", [v2Path(api)], () => apigw2.send(new CreateStageCommand({ ApiId: api, StageName: String(fd.get("stage")).trim(), AutoDeploy: fd.get("autoDeploy") === "on" })));
}

export async function deleteV2Stages(fd: FormData) {
  const api = String(fd.get("api"));
  const { apigw2 } = await aws();
  for (const s of fd.getAll("selected").map(String)) await guard(`Stage ${s} deleted.`, [v2Path(api)], () => apigw2.send(new DeleteStageCommand({ ApiId: api, StageName: s })));
}
