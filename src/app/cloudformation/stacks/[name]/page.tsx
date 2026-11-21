import Link from "next/link";
import {
  DescribeChangeSetCommand,
  DescribeStackEventsCommand,
  DescribeStacksCommand,
  GetTemplateCommand,
  ListChangeSetsCommand,
  ListStackResourcesCommand,
  type Change,
} from "@aws-sdk/client-cloudformation";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, Textarea, buttonClass } from "@/components/ui";
import { createChangeSet, deleteChangeSets, deleteStacks, detectDrift, executeChangeSet, updateStack } from "../../actions";
import { resourceHref, stackStatus } from "../../shared";

const TABS = ["info", "events", "resources", "outputs", "parameters", "template", "changesets", "update"] as const;
const LABELS: Record<(typeof TABS)[number], string> = { info: "Stack info", events: "Events", resources: "Resources", outputs: "Outputs", parameters: "Parameters", template: "Template", changesets: "Change sets", update: "Update" };

export default async function StackPage({ params, searchParams }: PageProps<"/cloudformation/stacks/[name]">) {
  const name = decodeURIComponent((await params).name);
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (String(sp.tab) as (typeof TABS)[number]) : "info";
  const changeSet = typeof sp.cs === "string" ? sp.cs : undefined;
  const { cfn } = await aws();
  let data;
  try {
    data = await Promise.all([
      cfn.send(new DescribeStacksCommand({ StackName: name })),
      cfn.send(new DescribeStackEventsCommand({ StackName: name })).catch(() => ({ StackEvents: [] })),
      cfn.send(new ListStackResourcesCommand({ StackName: name })).catch(() => ({ StackResourceSummaries: [] })),
      cfn.send(new GetTemplateCommand({ StackName: name })).catch(() => ({ TemplateBody: "" })),
      cfn.send(new ListChangeSetsCommand({ StackName: name })).catch(() => ({ Summaries: [] })),
      changeSet ? cfn.send(new DescribeChangeSetCommand({ StackName: name, ChangeSetName: changeSet })).catch((e) => ({ error: errorMessage(e) })) : Promise.resolve(null),
    ]);
  } catch (e) {
    return (<Page><Header variant="h1">{name}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  const [ds, ev, res, tpl, cs, csDetail] = data;
  const s = ds.Stacks![0];
  const base = `/cloudformation/stacks/${encodeURIComponent(name)}`;
  const hidden = <input type="hidden" name="name" value={name} />;
  let templateText = typeof tpl.TemplateBody === "string" ? tpl.TemplateBody : JSON.stringify(tpl.TemplateBody ?? "");
  try {
    templateText = JSON.stringify(JSON.parse(templateText), null, 2);
  } catch {}
  const paramsText = (s.Parameters ?? []).map((p) => `${p.ParameterKey}=${p.ParameterValue}`).join("\n");
  return (
    <Page wide>
      <Header
        variant="h1"
        actions={
          <>
            <LinkButton href={`${base}?tab=${tab}`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
            <ConfirmAction values={[name]} extra={{ from: "detail" }} action={deleteStacks} label="Delete" title="Delete stack" noun="stack" confirmWord="delete" />
            <LinkButton href={`${base}?tab=update`} variant="primary">Update</LinkButton>
          </>
        }
      >
        {name}
      </Header>
      <Tabs base={base} active={tab} tabs={TABS.map((t) => ({ id: t, label: LABELS[t] }))} />
      {tab === "info" && (
        <Container
          header={
            <Header actions={<form action={detectDrift}>{hidden}<button className={buttonClass("normal")}>Detect drift</button></form>}>Overview</Header>
          }
        >
          <KeyValue
            items={[
              { label: "Stack ID", value: <span className="font-mono text-xs break-all">{s.StackId}</span> },
              { label: "Status", value: stackStatus(s.StackStatus) },
              { label: "Status reason", value: s.StackStatusReason ?? "-" },
              { label: "Description", value: s.Description ?? "-" },
              { label: "Created time", value: formatDate(s.CreationTime) },
              { label: "Updated time", value: formatDate(s.LastUpdatedTime) },
              { label: "Drift status", value: s.DriftInformation?.StackDriftStatus ?? "NOT_CHECKED" },
              { label: "Termination protection", value: s.EnableTerminationProtection ? "Activated" : "Deactivated" },
              { label: "IAM role", value: s.RoleARN ?? "-" },
            ]}
          />
        </Container>
      )}
      {tab === "events" && (
        <Container noPadding header={<div className="space-y-3"><Header counter={ev.StackEvents?.length ?? 0}>Events</Header><TableFilter tableId="ev-table" placeholder="Search events" /></div>}>
          <Table
            id="ev-table"
            rows={ev.StackEvents ?? []}
            rowKey={(e) => e.EventId!}
            filterText={(e) => `${e.LogicalResourceId} ${e.ResourceType} ${e.ResourceStatus} ${e.ResourceStatusReason ?? ""}`}
            columns={[
              { header: "Timestamp", cell: (e) => formatDate(e.Timestamp) },
              { header: "Logical ID", cell: (e) => e.LogicalResourceId },
              { header: "Status", cell: (e) => stackStatus(e.ResourceStatus) },
              { header: "Status reason", cell: (e) => e.ResourceStatusReason ?? "-" },
            ]}
            empty={<EmptyState title="No events" />}
          />
        </Container>
      )}
      {tab === "resources" && (
        <Container noPadding header={<Header counter={res.StackResourceSummaries?.length ?? 0} description="Resources with a Consolation page link to it.">Resources</Header>}>
          <Table
            rows={res.StackResourceSummaries ?? []}
            rowKey={(r) => r.LogicalResourceId!}
            columns={[
              { header: "Logical ID", cell: (r) => r.LogicalResourceId },
              { header: "Physical ID", cell: (r) => { const href = resourceHref(r.ResourceType, r.PhysicalResourceId); return href ? <Link className="underline-link font-mono text-xs break-all" href={href}>{r.PhysicalResourceId}</Link> : <span className="font-mono text-xs break-all">{r.PhysicalResourceId ?? "-"}</span>; } },
              { header: "Type", cell: (r) => r.ResourceType },
              { header: "Status", cell: (r) => stackStatus(r.ResourceStatus) },
              { header: "Drift", cell: (r) => r.DriftInformation?.StackResourceDriftStatus ?? "-" },
            ]}
            empty={<EmptyState title="No resources" />}
          />
        </Container>
      )}
      {tab === "outputs" && (
        <Container noPadding header={<Header counter={s.Outputs?.length ?? 0}>Outputs</Header>}>
          <Table
            rows={s.Outputs ?? []}
            rowKey={(o) => o.OutputKey!}
            columns={[
              { header: "Key", cell: (o) => o.OutputKey },
              { header: "Value", cell: (o) => <span className="font-mono text-[13px] break-all">{o.OutputValue}</span> },
              { header: "Description", cell: (o) => o.Description || "-" },
              { header: "Export name", cell: (o) => o.ExportName || "-" },
            ]}
            empty={<EmptyState title="No outputs" />}
          />
        </Container>
      )}
      {tab === "parameters" && (
        <Container noPadding header={<Header counter={s.Parameters?.length ?? 0}>Parameters</Header>}>
          <Table rows={s.Parameters ?? []} rowKey={(p) => p.ParameterKey!} columns={[{ header: "Key", cell: (p) => p.ParameterKey }, { header: "Value", cell: (p) => p.ParameterValue }, { header: "Resolved value", cell: (p) => p.ResolvedValue ?? "-" }]} empty={<EmptyState title="No parameters" />} />
        </Container>
      )}
      {tab === "template" && (
        <Container header={<Header>Template</Header>}>
          <pre className="max-h-[640px] overflow-auto rounded-lg bg-[#f6f6f5] p-3 font-mono text-[13px]">{templateText}</pre>
        </Container>
      )}
      {tab === "changesets" && (
        <>
          <Container
            noPadding
            header={
              <Header
                counter={cs.Summaries?.length ?? 0}
                actions={
                  <>
                    <ConfirmAction formId="cs-form" action={deleteChangeSets} extra={{ name }} label="Delete" title="Delete change set" noun="change set" confirmWord="delete" />
                    <ConfirmAction formId="cs-form" action={executeChangeSet} extra={{ name }} label="Execute change set" title="Execute change set" noun="change set" confirmWord="execute" confirmLabel="Execute" />
                  </>
                }
              >
                Change sets
              </Header>
            }
          >
            <form id="cs-form" />
            <Table
              formId="cs-form"
              selection="single"
              rows={cs.Summaries ?? []}
              rowKey={(c) => c.ChangeSetName!}
              columns={[
                { header: "Name", cell: (c) => <Link className="underline-link" href={`${base}?tab=changesets&cs=${encodeURIComponent(c.ChangeSetName!)}`}>{c.ChangeSetName}</Link> },
                { header: "Status", cell: (c) => stackStatus(c.Status) },
                { header: "Execution status", cell: (c) => c.ExecutionStatus },
                { header: "Created", cell: (c) => formatDate(c.CreationTime) },
              ]}
              empty={<EmptyState title="No change sets" description="Create one from the Update tab." />}
            />
          </Container>
          {csDetail && (
            <Container noPadding header={<Header description={changeSet}>Changes</Header>}>
              {"error" in csDetail ? (
                <div className="px-5 pb-4"><ErrorAlert message={String(csDetail.error)} /></div>
              ) : (
                <Table
                  rows={csDetail.Changes ?? []}
                  rowKey={(c: Change) => `${c.ResourceChange?.LogicalResourceId}-${c.ResourceChange?.Action}`}
                  columns={[
                    { header: "Action", cell: (c: Change) => c.ResourceChange?.Action },
                    { header: "Logical ID", cell: (c: Change) => c.ResourceChange?.LogicalResourceId },
                    { header: "Type", cell: (c: Change) => c.ResourceChange?.ResourceType },
                    { header: "Replacement", cell: (c: Change) => c.ResourceChange?.Replacement ?? "-" },
                  ]}
                  empty={<EmptyState title="No changes" />}
                />
              )}
            </Container>
          )}
        </>
      )}
      {tab === "update" && (
        <Container header={<Header description="Update directly, or create a change set to review the changes first.">Update stack</Header>}>
          <form className="space-y-4">
            {hidden}
            <Textarea name="template" rows={20} defaultValue={templateText} spellCheck={false} />
            <FormField label="Parameters" description="One Key=Value per line."><Textarea name="parameters" rows={3} defaultValue={paramsText} /></FormField>
            <FormField label="Change set name (for change sets)"><Input name="changeSet" placeholder={`cs-${new Date().toISOString().slice(0, 10)}`} /></FormField>
            <div className="flex justify-end gap-2">
              <button formAction={createChangeSet} className={buttonClass("normal")}>Create change set</button>
              <button formAction={updateStack} className={buttonClass("primary")}>Update stack</button>
            </div>
          </form>
        </Container>
      )}
    </Page>
  );
}
