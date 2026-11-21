import { ListHealthChecksCommand, type HealthCheck } from "@aws-sdk/client-route-53";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { createHealthCheck, deleteHealthChecks } from "../actions";

export const metadata = { title: "Health checks | Route 53" };

export default async function HealthChecksPage() {
  let checks: HealthCheck[] = [];
  let error: string | null = null;
  try {
    const { route53 } = await aws();
    checks = (await route53.send(new ListHealthChecksCommand({ MaxItems: 100 }))).HealthChecks ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Container
        noPadding
        header={
          <Header
            counter={checks.length}
            info
            description="The emulator stores health checks; it does not probe endpoints."
            actions={
              <>
                <ConfirmAction formId="hc-form" action={deleteHealthChecks} label="Delete" title="Delete health checks" noun="health check" confirmWord="delete" />
                <ModalButton label="Create health check" title="Create health check" variant="primary">
                  <form action={createHealthCheck} className="space-y-4">
                    <FormField label="Protocol"><Select name="protocol" defaultValue="HTTPS">{["HTTP", "HTTPS", "TCP", "HTTP_STR_MATCH", "HTTPS_STR_MATCH"].map((p) => <option key={p}>{p}</option>)}</Select></FormField>
                    <FormField label="Domain name"><Input name="domain" placeholder="www.example.com" /></FormField>
                    <FormField label="IP address" description="Either a domain name or an IP address."><Input name="ip" /></FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Port"><Input name="port" type="number" defaultValue={443} /></FormField>
                      <FormField label="Path"><Input name="path" defaultValue="/" /></FormField>
                    </div>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create health check</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Health checks
          </Header>
        }
      >
        <form id="hc-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          formId="hc-form"
          selection="multi"
          rows={checks}
          rowKey={(h) => h.Id!}
          columns={[
            { header: "ID", cell: (h) => <span className="font-mono text-[13px]">{h.Id}</span> },
            { header: "Protocol", cell: (h) => h.HealthCheckConfig?.Type },
            { header: "Endpoint", cell: (h) => `${h.HealthCheckConfig?.FullyQualifiedDomainName ?? h.HealthCheckConfig?.IPAddress ?? "-"}:${h.HealthCheckConfig?.Port ?? ""}${h.HealthCheckConfig?.ResourcePath ?? ""}` },
            { header: "Interval", cell: (h) => `${h.HealthCheckConfig?.RequestInterval ?? 30}s` },
            { header: "Failure threshold", cell: (h) => h.HealthCheckConfig?.FailureThreshold ?? 3 },
          ]}
          empty={<EmptyState title="No health checks" />}
        />
      </Container>
    </Page>
  );
}
