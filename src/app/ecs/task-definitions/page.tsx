import Link from "next/link";
import { ListTaskDefinitionFamiliesCommand } from "@aws-sdk/client-ecs";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";

export const metadata = { title: "Task definitions | ECS" };

export default async function TaskDefsPage() {
  let families: string[] = [];
  let error: string | null = null;
  try {
    const { ecs } = await aws();
    families = (await ecs.send(new ListTaskDefinitionFamiliesCommand({ status: "ACTIVE", maxResults: 100 }))).families ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header counter={families.length} info actions={<><LinkButton href="/ecs/task-definitions" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton><LinkButton href="/ecs/task-definitions/create" variant="primary">Create new task definition</LinkButton></>}>
              Task definitions
            </Header>
            <TableFilter tableId="td-table" placeholder="Filter task definitions" />
          </div>
        }
      >
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="td-table"
          rows={families}
          rowKey={(f) => f}
          filterText={(f) => f}
          columns={[{ header: "Task definition", cell: (f) => <Link className="underline-link" href={`/ecs/task-definitions/${encodeURIComponent(f)}`}>{f}</Link> }]}
          empty={<EmptyState title="No task definitions" action={<LinkButton href="/ecs/task-definitions/create">Create new task definition</LinkButton>} />}
        />
      </Container>
    </Page>
  );
}
