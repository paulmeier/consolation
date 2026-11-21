import { DescribeTaskDefinitionCommand, ListTaskDefinitionsCommand } from "@aws-sdk/client-ecs";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton } from "@/components/ui";
import { deregisterTaskDefs } from "../../actions";

export default async function FamilyPage({ params, searchParams }: PageProps<"/ecs/task-definitions/[family]">) {
  const family = decodeURIComponent((await params).family);
  const rev = typeof (await searchParams).rev === "string" ? String((await searchParams).rev) : undefined;
  const { ecs } = await aws();
  let arns: string[] = [];
  let json = "";
  try {
    arns = (await ecs.send(new ListTaskDefinitionsCommand({ familyPrefix: family, sort: "DESC", maxResults: 100 }))).taskDefinitionArns ?? [];
    const target = rev ? `${family}:${rev}` : arns[0];
    if (target) json = JSON.stringify((await ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: target }))).taskDefinition, null, 2);
  } catch (e) {
    return (<Page><Header variant="h1">{family}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const base = `/ecs/task-definitions/${encodeURIComponent(family)}`;
  return (
    <Page wide>
      <Header variant="h1" actions={<LinkButton href="/ecs/task-definitions/create" variant="primary">Create new revision</LinkButton>}>{family}</Header>
      <Container
        noPadding
        header={<Header counter={arns.length} actions={<ConfirmAction formId="rev-form" action={deregisterTaskDefs} extra={{ family }} label="Deregister" title="Deregister revisions" noun="revision" confirmWord="deregister" confirmLabel="Deregister" />}>Revisions</Header>}
      >
        <form id="rev-form" />
        <Table
          formId="rev-form"
          selection="multi"
          rows={arns}
          rowKey={(a) => a}
          columns={[
            { header: "Revision", cell: (a) => <a className="underline-link" href={`${base}?rev=${a.split(":").pop()}`}>{a.split("/").pop()}</a>, sortValue: (a) => Number(a.split(":").pop()) },
            { header: "ARN", cell: (a) => <span className="font-mono text-xs break-all">{a}</span> },
          ]}
          empty={<EmptyState title="No active revisions" />}
        />
      </Container>
      {json && (
        <Container header={<Header>JSON</Header>}>
          <pre className="max-h-[560px] overflow-auto rounded-lg bg-code p-3 font-mono text-[13px]">{json}</pre>
        </Container>
      )}
    </Page>
  );
}
