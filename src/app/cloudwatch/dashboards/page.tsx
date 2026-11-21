import Link from "next/link";
import { ListDashboardsCommand, type DashboardEntry } from "@aws-sdk/client-cloudwatch";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, buttonClass } from "@/components/ui";
import { deleteDashboards, saveDashboard } from "../metric-actions";
import { STARTER_DASHBOARD } from "../dashboard-shared";

export const metadata = { title: "Dashboards | CloudWatch" };

export default async function DashboardsPage() {
  let list: DashboardEntry[] = [];
  let error: string | null = null;
  try {
    const { cloudwatch } = await aws();
    list = (await cloudwatch.send(new ListDashboardsCommand({}))).DashboardEntries ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={list.length}
              info
              actions={
                <>
                  <ConfirmAction formId="dash-form" action={deleteDashboards} label="Delete" title="Delete dashboards" noun="dashboard" confirmWord="delete" />
                  <ModalButton label="Create dashboard" title="Create new dashboard" variant="primary">
                    <form action={saveDashboard} className="space-y-4">
                      <FormField label="Dashboard name" constraint="Letters, numbers, - and _ only."><Input name="name" required maxLength={255} pattern="[A-Za-z0-9_\-]+" autoFocus /></FormField>
                      <input type="hidden" name="body" value={STARTER_DASHBOARD} />
                      <p className="text-sm text-muted">Starts with a text widget and a metric widget for Consolation/Demo RequestCount; edit the JSON afterwards.</p>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create dashboard</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Custom dashboards
            </Header>
            <TableFilter tableId="dash-table" placeholder="Filter dashboards" />
          </div>
        }
      >
        <form id="dash-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="dash-table"
          formId="dash-form"
          selection="multi"
          rows={list}
          rowKey={(d) => d.DashboardName!}
          filterText={(d) => d.DashboardName!}
          columns={[
            { header: "Name", cell: (d) => <Link className="underline-link" href={`/cloudwatch/dashboards/${encodeURIComponent(d.DashboardName!)}`}>{d.DashboardName}</Link> },
            { header: "Last updated", cell: (d) => formatDate(d.LastModified) },
          ]}
          empty={<EmptyState title="No dashboards" />}
        />
      </Container>
    </Page>
  );
}
