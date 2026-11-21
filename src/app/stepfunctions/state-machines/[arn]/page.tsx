import Link from "next/link";
import { DescribeStateMachineCommand, ListExecutionsCommand } from "@aws-sdk/client-sfn";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, Textarea, buttonClass } from "@/components/ui";
import { deleteStateMachines, startExecution, updateStateMachine } from "../../actions";
import { DefinitionEditor } from "../../definition-editor";
import { AslGraph } from "../../graph";
import { execPath, execStatus, smPath } from "../../shared";

export default async function MachinePage({ params, searchParams }: PageProps<"/stepfunctions/state-machines/[arn]">) {
  const arn = decodeURIComponent((await params).arn);
  const tab = String((await searchParams).tab ?? "executions");
  const { sfn } = await aws();
  let data;
  try {
    data = await Promise.all([
      sfn.send(new DescribeStateMachineCommand({ stateMachineArn: arn })),
      sfn.send(new ListExecutionsCommand({ stateMachineArn: arn, maxResults: 100 })).catch(() => ({ executions: [] })),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{arn.split(":").pop()}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [sm, ex] = data;
  const base = smPath(arn);
  return (
    <Page wide>
      <Header
        variant="h1"
        actions={
          <>
            <ConfirmAction values={[arn]} action={deleteStateMachines} extra={{ from: "detail" }} label="Delete" title="Delete state machine" noun="state machine" confirmWord="delete" />
            <LinkButton href={`${base}?tab=definition`}>Edit</LinkButton>
            <ModalButton label="Start execution" title="Start execution" variant="primary" size="lg">
              <form action={startExecution} className="space-y-4">
                <input type="hidden" name="arn" value={arn} />
                <FormField label={<>Name <i className="font-normal text-muted">- optional</i></>} description="Leave empty for a generated name.">
                  <Input name="name" maxLength={80} />
                </FormField>
                <FormField label="Input" description="Enter input values for this execution in JSON format.">
                  <Textarea name="input" rows={10} defaultValue={'{\n  "Comment": "Insert your JSON here"\n}'} spellCheck={false} />
                </FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Start execution</button></div>
              </form>
            </ModalButton>
          </>
        }
      >
        {sm.name}
      </Header>
      <Container header={<Header>Details</Header>}>
        <KeyValue
          items={[
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{arn}</span> },
            { label: "Type", value: sm.type === "EXPRESS" ? "Express" : "Standard" },
            { label: "Status", value: sm.status },
            { label: "IAM role ARN", value: <span className="font-mono text-[13px] break-all">{sm.roleArn}</span> },
            { label: "Creation date", value: formatDate(sm.creationDate) },
            { label: "Revision", value: <span className="font-mono text-[13px]">{sm.revisionId ?? "-"}</span> },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "executions", label: "Executions" }, { id: "definition", label: "Definition" }]} />
      {tab === "executions" ? (
        <Container
          noPadding
          header={
            <div className="space-y-3">
              <Header counter={ex.executions?.length ?? 0} actions={<LinkButton href={base} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>}>
                Executions
              </Header>
              <TableFilter tableId="exec-table" placeholder="Search for executions" />
            </div>
          }
        >
          <Table
            id="exec-table"
            rows={ex.executions ?? []}
            rowKey={(e) => e.executionArn!}
            filterText={(e) => `${e.name} ${e.status}`}
            columns={[
              { header: "Name", cell: (e) => <Link className="underline-link" href={execPath(e.executionArn!)}>{e.name}</Link> },
              { header: "Status", cell: (e) => execStatus(e.status) },
              { header: "Started", cell: (e) => formatDate(e.startDate) },
              { header: "End time", cell: (e) => formatDate(e.stopDate) },
            ]}
            empty={<EmptyState title="No executions" description="Start an execution to see it here." />}
          />
        </Container>
      ) : (
        <Container header={<Header description="Saving updates the state machine; running executions keep the old definition.">Definition</Header>}>
          <form action={updateStateMachine} className="space-y-3">
            <input type="hidden" name="arn" value={arn} />
            <input type="hidden" name="type" value={sm.type} />
            <DefinitionEditor name="definition" initial={(() => { try { return JSON.stringify(JSON.parse(sm.definition ?? "{}"), null, 2); } catch { return sm.definition ?? ""; } })()} />
            <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
          </form>
        </Container>
      )}
      {tab === "executions" && sm.definition && (
        <Container header={<Header>Graph</Header>}>
          <AslGraph definition={sm.definition} />
        </Container>
      )}
    </Page>
  );
}
