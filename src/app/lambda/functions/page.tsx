import Link from "next/link";
import { Suspense } from "react";
import { ListFunctionsCommand, type FunctionConfiguration } from "@aws-sdk/client-lambda";
import { aws, errorMessage } from "@/lib/emulator";
import { formatBytes, formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon } from "@/components/ui";
import { deleteFunctions } from "../actions";

export const metadata = { title: "Functions | Lambda" };
const FORM = "functions-form";

async function Functions() {
  let fns: FunctionConfiguration[] = [];
  let error: string | null = null;
  try {
    const { lambda } = await aws();
    let marker: string | undefined;
    do {
      const res = await lambda.send(new ListFunctionsCommand({ Marker: marker }));
      fns.push(...(res.Functions ?? []));
      marker = res.NextMarker;
    } while (marker);
    fns = fns.sort((a, b) => a.FunctionName!.localeCompare(b.FunctionName!));
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={fns.length}
            info
            actions={
              <>
                <LinkButton href="/lambda/functions" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={deleteFunctions} label="Delete" title="Delete function" noun="function" confirmWord="confirm" description="Deleting a function permanently removes the function code. The related logs and roles are not deleted." />
                <LinkButton href="/lambda/functions/create" variant="primary">Create function</LinkButton>
              </>
            }
          >
            Functions
          </Header>
          <TableFilter tableId="fn-table" placeholder="Filter by attributes or search by keyword" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="fn-table"
        formId={FORM}
        selection="multi"
        rows={fns}
        rowKey={(f) => f.FunctionName!}
        filterText={(f) => `${f.FunctionName} ${f.Runtime} ${f.Description}`}
        columns={[
          { header: "Function name", cell: (f) => <Link className="underline-link" href={`/lambda/functions/${encodeURIComponent(f.FunctionName!)}`}>{f.FunctionName}</Link> },
          { header: "Description", cell: (f) => f.Description || "-" },
          { header: "Package type", cell: (f) => f.PackageType ?? "Zip" },
          { header: "Runtime", cell: (f) => f.Runtime ?? "-" },
          { header: "Code size", cell: (f) => formatBytes(f.CodeSize) },
          { header: "Last modified", cell: (f) => formatDate(f.LastModified) },
        ]}
        empty={<EmptyState title="No functions" description="There is no data to display." action={<LinkButton href="/lambda/functions/create">Create function</LinkButton>} />}
      />
    </Container>
  );
}

export default function FunctionsPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Functions</Header>}>Loading functions…</Container>}>
        <Functions />
      </Suspense>
    </Page>
  );
}
