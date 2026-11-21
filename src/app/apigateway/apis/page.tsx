import Link from "next/link";
import { GetRestApisCommand } from "@aws-sdk/client-api-gateway";
import { GetApisCommand } from "@aws-sdk/client-apigatewayv2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createApi, deleteApis } from "../actions";

export const metadata = { title: "APIs | API Gateway" };

type Row = { id: string; name: string; type: "REST" | "HTTP" | "WEBSOCKET"; description?: string; created?: Date; endpoint: string };

export default async function ApisPage() {
  let rows: Row[] = [];
  let error: string | null = null;
  try {
    const { apigw, apigw2 } = await aws();
    const [rest, v2] = await Promise.all([apigw.send(new GetRestApisCommand({ limit: 500 })), apigw2.send(new GetApisCommand({ MaxResults: "500" }))]);
    rows = [
      ...(rest.items ?? []).map((a) => ({ id: a.id!, name: a.name!, type: "REST" as const, description: a.description, created: a.createdDate, endpoint: a.endpointConfiguration?.types?.join(", ") ?? "REGIONAL" })),
      ...(v2.Items ?? []).map((a) => ({ id: a.ApiId!, name: a.Name!, type: a.ProtocolType as "HTTP" | "WEBSOCKET", description: a.Description, created: a.CreatedDate, endpoint: "Regional" })),
    ];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={rows.length}
              info
              actions={
                <>
                  <LinkButton href="/apigateway/apis" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="apis-form" action={deleteApis} label="Delete" title="Delete API" noun="API" confirmWord="confirm" />
                  <ModalButton label="Create API" title="Create API" variant="primary">
                    <form action={createApi} className="space-y-4">
                      <FormField label="API type">
                        <Select name="type" defaultValue="HTTP">
                          <option value="HTTP">HTTP API</option>
                          <option value="WEBSOCKET">WebSocket API</option>
                          <option value="REST">REST API</option>
                        </Select>
                      </FormField>
                      <FormField label="API name"><Input name="name" required maxLength={128} autoFocus /></FormField>
                      <FormField label={<>Description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create API</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              APIs
            </Header>
            <TableFilter tableId="apis-table" placeholder="Find APIs" />
          </div>
        }
      >
        <form id="apis-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="apis-table"
          formId="apis-form"
          selection="single"
          rows={rows}
          rowKey={(r) => `${r.type}|${r.id}`}
          filterText={(r) => `${r.name} ${r.id} ${r.type} ${r.description ?? ""}`}
          columns={[
            { header: "Name", cell: (r) => <Link className="underline-link" href={r.type === "REST" ? `/apigateway/rest/${r.id}` : `/apigateway/v2/${r.id}`}>{r.name}</Link> },
            { header: "Description", cell: (r) => r.description || "-" },
            { header: "ID", cell: (r) => <span className="font-mono text-[13px]">{r.id}</span> },
            { header: "Protocol", cell: (r) => r.type },
            { header: "API endpoint type", cell: (r) => r.endpoint },
            { header: "Created", cell: (r) => formatDate(r.created) },
          ]}
          empty={<EmptyState title="No APIs" />}
        />
      </Container>
    </Page>
  );
}
