import Link from "next/link";
import { ListStacksCommand, type StackSummary } from "@aws-sdk/client-cloudformation";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { deleteStacks } from "../actions";
import { CoverageBanner, stackStatus } from "../shared";

export const metadata = { title: "Stacks | CloudFormation" };

export default async function StacksPage({ searchParams }: PageProps<"/cloudformation/stacks">) {
  const showDeleted = (await searchParams).deleted === "1";
  let stacks: StackSummary[] = [];
  let error: string | null = null;
  try {
    const { cfn } = await aws();
    let token: string | undefined;
    do {
      const r = await cfn.send(new ListStacksCommand({ NextToken: token }));
      stacks.push(...(r.StackSummaries ?? []));
      token = r.NextToken;
    } while (token);
    if (!showDeleted) stacks = stacks.filter((s) => s.StackStatus !== "DELETE_COMPLETE");
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <CoverageBanner />
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={stacks.length}
              info
              description={<Link href={showDeleted ? "/cloudformation/stacks" : "/cloudformation/stacks?deleted=1"} className="underline-link">{showDeleted ? "Hide deleted stacks" : "Show deleted stacks"}</Link>}
              actions={
                <>
                  <LinkButton href="/cloudformation/stacks" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="stacks-form" action={deleteStacks} label="Delete" title="Delete stack" noun="stack" confirmWord="delete" description="Deleting a stack deletes all of its resources." />
                  <LinkButton href="/cloudformation/stacks/create" variant="primary">Create stack</LinkButton>
                </>
              }
            >
              Stacks
            </Header>
            <TableFilter tableId="stacks-table" placeholder="Filter by stack name" />
          </div>
        }
      >
        <form id="stacks-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="stacks-table"
          formId="stacks-form"
          selection="single"
          rows={stacks}
          rowKey={(s) => s.StackName!}
          filterText={(s) => `${s.StackName} ${s.StackStatus} ${s.TemplateDescription ?? ""}`}
          columns={[
            { header: "Stack name", cell: (s) => (s.StackStatus === "DELETE_COMPLETE" ? s.StackName : <Link className="underline-link" href={`/cloudformation/stacks/${encodeURIComponent(s.StackName!)}`}>{s.StackName}</Link>) },
            { header: "Status", cell: (s) => stackStatus(s.StackStatus) },
            { header: "Created time", cell: (s) => formatDate(s.CreationTime) },
            { header: "Description", cell: (s) => s.TemplateDescription || "-" },
          ]}
          empty={<EmptyState title="No stacks" description="No stacks to display." action={<LinkButton href="/cloudformation/stacks/create">Create stack</LinkButton>} />}
        />
      </Container>
    </Page>
  );
}
