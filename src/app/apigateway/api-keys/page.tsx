import { GetApiKeysCommand, GetRestApisCommand, GetStagesCommand, GetUsagePlansCommand, type ApiKey, type UsagePlan } from "@aws-sdk/client-api-gateway";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { createApiKey, createUsagePlan, deleteApiKeys, deleteUsagePlans } from "../actions";

export const metadata = { title: "API keys and usage plans | API Gateway" };

export default async function KeysPage() {
  let keys: ApiKey[] = [];
  let plans: UsagePlan[] = [];
  let stages: { value: string; label: string }[] = [];
  let error: string | null = null;
  try {
    const { apigw } = await aws();
    [keys, plans] = await Promise.all([
      apigw.send(new GetApiKeysCommand({ includeValues: true, limit: 500 })).then((r) => r.items ?? []),
      apigw.send(new GetUsagePlansCommand({ limit: 500 })).then((r) => r.items ?? []),
    ]);
    const apis = (await apigw.send(new GetRestApisCommand({ limit: 500 }))).items ?? [];
    stages = (await Promise.all(apis.map(async (a) => ((await apigw.send(new GetStagesCommand({ restApiId: a.id }))).item ?? []).map((s) => ({ value: `${a.id}|${s.stageName}`, label: `${a.name} / ${s.stageName}` }))))).flat();
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            counter={keys.length}
            info
            description="Send the key value in the x-api-key header to methods that require an API key."
            actions={
              <>
                <ConfirmAction formId="keys-form" action={deleteApiKeys} label="Delete" title="Delete API key" noun="API key" confirmWord="confirm" />
                <ModalButton label="Create API key" title="Create API key" variant="primary">
                  <form action={createApiKey} className="space-y-4">
                    <FormField label="Name"><Input name="name" required autoFocus /></FormField>
                    <FormField label={<>API key value <i className="font-normal text-muted">- optional, auto-generated if empty</i></>} constraint="At least 20 characters."><Input name="value" minLength={20} /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            API keys
          </Header>
        }
      >
        <form id="keys-form" />
        <Table
          formId="keys-form"
          selection="multi"
          rows={keys}
          rowKey={(k) => k.id!}
          columns={[
            { header: "Name", cell: (k) => k.name },
            { header: "API key", cell: (k) => <span className="font-mono text-xs break-all">{k.value}</span> },
            { header: "Status", cell: (k) => (k.enabled ? "Active" : "Inactive") },
            { header: "Created", cell: (k) => formatDate(k.createdDate) },
          ]}
          empty={<EmptyState title="No API keys" />}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={plans.length}
            actions={
              <>
                <ConfirmAction formId="plans-form" action={deleteUsagePlans} label="Delete" title="Delete usage plan" noun="usage plan" confirmWord="confirm" />
                <ModalButton label="Create usage plan" title="Create usage plan" variant="primary">
                  <form action={createUsagePlan} className="space-y-4">
                    <FormField label="Name"><Input name="name" required autoFocus /></FormField>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField label="Rate (req/s)"><Input name="rate" type="number" defaultValue={10} /></FormField>
                      <FormField label="Burst"><Input name="burst" type="number" defaultValue={20} /></FormField>
                      <FormField label="Quota per day"><Input name="quota" type="number" defaultValue={0} /></FormField>
                    </div>
                    <FormField label="API stage"><Select name="stage" defaultValue=""><option value="">None</option>{stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></FormField>
                    <FormField label="API key"><Select name="key" defaultValue=""><option value="">None</option>{keys.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create usage plan</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Usage plans
          </Header>
        }
      >
        <form id="plans-form" />
        <Table
          formId="plans-form"
          selection="multi"
          rows={plans}
          rowKey={(p) => p.id!}
          columns={[
            { header: "Name", cell: (p) => p.name },
            { header: "Throttling", cell: (p) => (p.throttle ? `${p.throttle.rateLimit} req/s, burst ${p.throttle.burstLimit}` : "-") },
            { header: "Quota", cell: (p) => (p.quota ? `${p.quota.limit} per ${p.quota.period?.toLowerCase()}` : "-") },
            { header: "API stages", cell: (p) => (p.apiStages ?? []).map((s) => `${s.apiId}/${s.stage}`).join(", ") || "-" },
          ]}
          empty={<EmptyState title="No usage plans" />}
        />
      </Container>
    </Page>
  );
}
