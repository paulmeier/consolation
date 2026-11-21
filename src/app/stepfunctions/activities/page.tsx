import { ListActivitiesCommand, type ActivityListItem } from "@aws-sdk/client-sfn";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, buttonClass } from "@/components/ui";
import { createActivity, deleteActivities } from "../actions";

export const metadata = { title: "Activities | Step Functions" };

export default async function ActivitiesPage() {
  let list: ActivityListItem[] = [];
  let error: string | null = null;
  try {
    const { sfn } = await aws();
    list = (await sfn.send(new ListActivitiesCommand({ maxResults: 1000 }))).activities ?? [];
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
              description="Activities let a worker you host poll Step Functions for tasks (GetActivityTask)."
              actions={
                <>
                  <ConfirmAction formId="act-form" action={deleteActivities} label="Delete" title="Delete activity" noun="activity" confirmWord="delete" />
                  <ModalButton label="Create activity" title="Create activity" variant="primary">
                    <form action={createActivity} className="space-y-4">
                      <FormField label="Activity name"><Input name="name" required maxLength={80} pattern="[A-Za-z0-9_\-]+" autoFocus /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create activity</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Activities
            </Header>
            <TableFilter tableId="act-table" placeholder="Search activities" />
          </div>
        }
      >
        <form id="act-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="act-table"
          formId="act-form"
          selection="multi"
          rows={list}
          rowKey={(a) => a.activityArn!}
          filterText={(a) => a.name ?? ""}
          columns={[
            { header: "Name", cell: (a) => a.name },
            { header: "ARN", cell: (a) => <span className="font-mono text-[13px]">{a.activityArn}</span> },
            { header: "Creation date", cell: (a) => formatDate(a.creationDate) },
          ]}
          empty={<EmptyState title="No activities" />}
        />
      </Container>
    </Page>
  );
}
