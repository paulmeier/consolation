import Link from "next/link";
import { DescribeLogGroupsCommand, DescribeQueriesCommand, DescribeQueryDefinitionsCommand, type QueryDefinition, type QueryInfo } from "@aws-sdk/client-cloudwatch-logs";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, buttonClass } from "@/components/ui";
import { deleteQueryDefinition, saveQueryDefinition } from "../actions";
import { Insights, SAMPLE_QUERY } from "./insights";

export const metadata = { title: "Logs Insights | CloudWatch" };

export default async function LogsInsightsPage({ searchParams }: PageProps<"/cloudwatch/logs-insights">) {
  const sp = await searchParams;
  const { logs } = await aws();
  let groups: string[] = [];
  let saved: QueryDefinition[] = [];
  let history: QueryInfo[] = [];
  let error: string | null = null;
  try {
    [groups, saved, history] = await Promise.all([
      logs.send(new DescribeLogGroupsCommand({ limit: 50 })).then((r) => (r.logGroups ?? []).map((g) => g.logGroupName!)),
      logs.send(new DescribeQueryDefinitionsCommand({})).then((r) => r.queryDefinitions ?? []),
      logs.send(new DescribeQueriesCommand({ maxResults: 20 })).then((r) => r.queries ?? []).catch(() => []),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  const savedId = typeof sp.saved === "string" ? sp.saved : undefined;
  const chosen = saved.find((q) => q.queryDefinitionId === savedId);
  const initialGroups = chosen?.logGroupNames?.length ? chosen.logGroupNames : typeof sp.group === "string" ? [sp.group] : groups.slice(0, 1);
  return (
    <Page wide>
      <Header
        variant="h1"
        description="Query log events with the CloudWatch Logs Insights query language."
        actions={
          <ModalButton label="Save" title="Save query">
            <form id="save-query" action={saveQueryDefinition} className="space-y-4">
              {chosen && <input type="hidden" name="id" value={chosen.queryDefinitionId} />}
              <FormField label="Query name" description="Use / to put the query in a folder, for example errors/last-hour.">
                <Input name="name" required defaultValue={chosen?.name ?? ""} />
              </FormField>
              <p className="text-sm text-muted">Saves the query text and log groups currently in the editor.</p>
              <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
            </form>
          </ModalButton>
        }
      >
        Logs Insights
      </Header>
      {error && <ErrorAlert message={error} />}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Container>
          <Insights key={savedId ?? "new"} groups={groups} initialGroups={initialGroups} initialQuery={chosen?.queryString ?? SAMPLE_QUERY} />
        </Container>
        <div className="space-y-6">
          <Container noPadding header={<Header counter={saved.length}>Saved queries</Header>}>
            <Table
              rows={saved}
              rowKey={(q) => q.queryDefinitionId!}
              columns={[
                { header: "Name", cell: (q) => <Link className="text-accent hover:underline" href={`/cloudwatch/logs-insights?saved=${q.queryDefinitionId}`}>{q.name}</Link> },
                {
                  header: "",
                  sortable: false,
                  width: "80px",
                  cell: (q) => (
                    <form action={deleteQueryDefinition}>
                      <input type="hidden" name="id" value={q.queryDefinitionId} />
                      <button className={buttonClass("icon")} aria-label={`Delete ${q.name}`}>Delete</button>
                    </form>
                  ),
                },
              ]}
              empty={<EmptyState title="No saved queries" />}
            />
          </Container>
          <Container noPadding header={<Header counter={history.length}>Recent queries</Header>}>
            <Table
              rows={history}
              rowKey={(q) => q.queryId!}
              columns={[
                { header: "Query", cell: (q) => <code className="line-clamp-2 font-mono text-xs break-all">{q.queryString}</code> },
                { header: "Status", cell: (q) => q.status },
                { header: "Started", cell: (q) => formatDate(q.createTime) },
              ]}
              empty={<EmptyState title="No queries yet" />}
            />
          </Container>
        </div>
      </div>
    </Page>
  );
}
