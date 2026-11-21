import Link from "next/link";
import { Suspense } from "react";
import { DescribeLogGroupsCommand, type LogGroup } from "@aws-sdk/client-cloudwatch-logs";
import { aws, errorMessage } from "@/lib/emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createLogGroup, deleteLogGroups } from "../actions";

export const metadata = { title: "Log groups | CloudWatch" };
const FORM = "groups-form";

async function Groups() {
  const groups: LogGroup[] = [];
  let error: string | null = null;
  try {
    const { logs } = await aws();
    let token: string | undefined;
    do {
      const res = await logs.send(new DescribeLogGroupsCommand({ nextToken: token }));
      groups.push(...(res.logGroups ?? []));
      token = res.nextToken;
    } while (token);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={groups.length}
            info
            description="By default, we only load up to 10000 log groups."
            actions={
              <>
                <LinkButton href="/cloudwatch/log-groups" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteLogGroups} label="Delete" title="Delete log group(s)" noun="log group" confirmWord="delete" description="Deleting log groups deletes all their log streams and events." />
                <ModalButton label="Create log group" title="Create log group" variant="primary">
                  <form action={createLogGroup} className="space-y-4">
                    <FormField label="Log group name">
                      <Input name="name" required maxLength={512} placeholder="/aws/lambda/my-function" autoFocus />
                    </FormField>
                    <FormField label="Retention setting">
                      <Select name="retention" defaultValue="0">
                        <option value="0">Never expire</option>
                        {[1, 3, 5, 7, 14, 30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>)}
                      </Select>
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Log groups
          </Header>
          <TableFilter tableId="groups-table" placeholder="Filter log groups or try prefix search" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="groups-table"
        formId={FORM}
        selection="multi"
        rows={groups}
        rowKey={(g) => g.logGroupName!}
        filterText={(g) => g.logGroupName!}
        columns={[
          { header: "Log group", cell: (g) => <Link className="underline-link" href={`/cloudwatch/log-groups/${encodeURIComponent(g.logGroupName!)}`}>{g.logGroupName}</Link> },
          { header: "Log class", cell: (g) => g.logGroupClass ?? "Standard" },
          { header: "Retention", cell: (g) => (g.retentionInDays ? `${g.retentionInDays} days` : "Never expire") },
          { header: "Stored bytes", cell: (g) => formatBytes(g.storedBytes ?? 0), sortValue: (g) => g.storedBytes ?? 0 },
          { header: "Creation time", cell: (g) => formatDate(g.creationTime) },
        ]}
        empty={<EmptyState title="No log groups" description="You don't have any log groups." />}
      />
    </Container>
  );
}

export default function GroupsPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Log groups</Header>}>Loading log groups…</Container>}>
        <Groups />
      </Suspense>
    </Page>
  );
}
