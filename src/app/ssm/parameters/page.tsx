import Link from "next/link";
import { Suspense } from "react";
import { DescribeParametersCommand, type ParameterMetadata } from "@aws-sdk/client-ssm";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { deleteParameters } from "../actions";

export const metadata = { title: "Parameter Store | Systems Manager" };
const FORM = "params-form";

async function Parameters({ path }: { path: string }) {
  const params: ParameterMetadata[] = [];
  let error: string | null = null;
  try {
    const { ssm } = await aws();
    let token: string | undefined;
    do {
      const r = await ssm.send(
        new DescribeParametersCommand({
          NextToken: token,
          MaxResults: 50,
          ...(path ? { ParameterFilters: [{ Key: "Path", Option: "Recursive", Values: [path] }] } : {}),
        }),
      );
      params.push(...(r.Parameters ?? []));
      token = r.NextToken;
    } while (token);
  } catch (e) {
    error = errorMessage(e);
  }
  // Top-level hierarchy segments for quick path browsing.
  const roots = Array.from(new Set(params.map((p) => p.Name!).filter((n) => n.startsWith("/")).map((n) => "/" + n.split("/")[1])));
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={params.length}
            info
            description={path ? <>Showing parameters under <code className="font-mono">{path}</code>. <Link href="/ssm/parameters" className="underline-link">Show all</Link></> : undefined}
            actions={
              <>
                <LinkButton href={path ? `/ssm/parameters?path=${encodeURIComponent(path)}` : "/ssm/parameters"} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteParameters} label="Delete" title="Delete parameters" noun="parameter" confirmWord="delete" description="Deleted parameters can't be recovered." />
                <LinkButton href="/ssm/parameters/create" variant="primary">Create parameter</LinkButton>
              </>
            }
          >
            My parameters
          </Header>
          {!path && roots.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Browse by path:</span>
              {roots.map((r) => (
                <Link key={r} href={`/ssm/parameters?path=${encodeURIComponent(r)}`} className="rounded-full border border-line-strong px-2.5 py-0.5 hover:border-accent hover:text-accent">
                  {r}
                </Link>
              ))}
            </div>
          )}
          <TableFilter tableId="params-table" placeholder="Search parameters by name, type, tier or description" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="params-table"
        formId={FORM}
        selection="multi"
        rows={params}
        rowKey={(p) => p.Name!}
        filterText={(p) => `${p.Name} ${p.Type} ${p.Tier} ${p.Description ?? ""}`}
        columns={[
          { header: "Name", cell: (p) => <Link className="underline-link" href={`/ssm/parameters/view?name=${encodeURIComponent(p.Name!)}`}>{p.Name}</Link> },
          { header: "Tier", cell: (p) => p.Tier ?? "Standard" },
          { header: "Type", cell: (p) => p.Type },
          { header: "Data type", cell: (p) => p.DataType ?? "text" },
          { header: "Description", cell: (p) => p.Description || "-" },
          { header: "Last modified date", cell: (p) => formatDate(p.LastModifiedDate) },
          { header: "Version", cell: (p) => p.Version, sortValue: (p) => p.Version ?? 0 },
        ]}
        empty={<EmptyState title="No parameters" description="You don't have any parameters." action={<LinkButton href="/ssm/parameters/create">Create parameter</LinkButton>} />}
      />
    </Container>
  );
}

export default async function ParametersPage({ searchParams }: PageProps<"/ssm/parameters">) {
  const path = String((await searchParams).path ?? "");
  return (
    <Page>
      <Header variant="h1">Parameter Store</Header>
      <Suspense key={path} fallback={<Container header={<Header>My parameters</Header>}>Loading parameters…</Container>}>
        <Parameters path={path} />
      </Suspense>
    </Page>
  );
}
