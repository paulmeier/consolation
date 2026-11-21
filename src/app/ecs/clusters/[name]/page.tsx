import { DescribeClustersCommand, DescribeServicesCommand, DescribeTasksCommand, ListServicesCommand, ListTaskDefinitionsCommand, ListTasksCommand, type Service, type Task } from "@aws-sdk/client-ecs";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, RefreshIcon, Select, StatusIndicator, buttonClass } from "@/components/ui";
import { createService, deleteClusters, deleteServices, runTask, scaleService, stopTasks } from "../../actions";

const short = (arn?: string) => arn?.split("/").pop() ?? "-";

function taskStatus(s?: string) {
  if (s === "RUNNING") return <StatusIndicator type="success">Running</StatusIndicator>;
  if (s === "STOPPED") return <StatusIndicator type="stopped">Stopped</StatusIndicator>;
  return <StatusIndicator type="pending">{s ? s.charAt(0) + s.slice(1).toLowerCase() : "-"}</StatusIndicator>;
}

export default async function ClusterPage({ params, searchParams }: PageProps<"/ecs/clusters/[name]">) {
  const name = decodeURIComponent((await params).name);
  const tab = String((await searchParams).tab ?? "services");
  const { ecs } = await aws();
  let cluster;
  let services: Service[] = [];
  let tasks: Task[] = [];
  let taskDefs: string[] = [];
  try {
    cluster = (await ecs.send(new DescribeClustersCommand({ clusters: [name] }))).clusters?.[0];
    const [svcArns, taskArns, tds] = await Promise.all([
      ecs.send(new ListServicesCommand({ cluster: name, maxResults: 100 })).then((r) => r.serviceArns ?? []),
      Promise.all(["RUNNING", "STOPPED"].map((s) => ecs.send(new ListTasksCommand({ cluster: name, desiredStatus: s as "RUNNING" | "STOPPED", maxResults: 100 })).then((r) => r.taskArns ?? []))).then((x) => x.flat()),
      ecs.send(new ListTaskDefinitionsCommand({ status: "ACTIVE", sort: "DESC", maxResults: 100 })).then((r) => r.taskDefinitionArns ?? []),
    ]);
    taskDefs = tds;
    if (svcArns.length) services = (await ecs.send(new DescribeServicesCommand({ cluster: name, services: svcArns }))).services ?? [];
    if (taskArns.length) tasks = (await ecs.send(new DescribeTasksCommand({ cluster: name, tasks: taskArns }))).tasks ?? [];
  } catch (e) {
    return (<Page><Header variant="h1">{name}</Header><ErrorAlert message={errorMessage(e)} /></Page>);
  }
  if (!cluster) return (<Page><Header variant="h1">{name}</Header><ErrorAlert message="Cluster not found." /></Page>);
  const base = `/ecs/clusters/${encodeURIComponent(name)}`;
  const hidden = <input type="hidden" name="cluster" value={name} />;
  const tdSelect = <Select name="taskDefinition">{taskDefs.map((t) => <option key={t} value={t}>{short(t)}</option>)}</Select>;
  return (
    <Page wide>
      <Header variant="h1" info actions={<><LinkButton href={`${base}?tab=${tab}`} aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton><ConfirmAction values={[name]} extra={{ from: "detail" }} action={deleteClusters} label="Delete cluster" title="Delete cluster" noun="cluster" confirmWord="delete" /></>}>
        {name}
      </Header>
      <Container header={<Header>Cluster overview</Header>}>
        <KeyValue columns={4} items={[
          { label: "ARN", value: <span className="font-mono text-xs break-all">{cluster.clusterArn}</span> },
          { label: "Status", value: cluster.status },
          { label: "Services", value: cluster.activeServicesCount ?? services.length },
          { label: "Tasks", value: `${cluster.pendingTasksCount ?? 0} pending, ${cluster.runningTasksCount ?? 0} running` },
        ]} />
      </Container>
      <Tabs base={base} active={tab} tabs={[{ id: "services", label: "Services" }, { id: "tasks", label: "Tasks" }]} />
      {tab === "services" ? (
        <Container
          noPadding
          header={
            <Header
              counter={services.length}
              actions={
                <>
                  <ConfirmAction formId="svc-form" action={deleteServices} extra={{ cluster: name }} label="Delete service" title="Delete service" noun="service" confirmWord="delete" description="Running tasks are stopped (force delete)." />
                  <ConfirmAction
                    formId="svc-form"
                    action={scaleService}
                    extra={{ cluster: name }}
                    label="Update service"
                    title="Update desired tasks"
                    noun="service"
                    confirmWord="update"
                    confirmLabel="Update"
                    description="Set the number of tasks to keep running."
                    fields={<div className="space-y-1"><label className="block text-sm font-bold">Desired tasks</label><Input name="desired" type="number" min={0} defaultValue={1} /></div>}
                  />
                  <ModalButton label="Create" title="Create service" variant="primary">
                    <form action={createService} className="space-y-4">
                      {hidden}
                      <FormField label="Task definition family / revision">{tdSelect}</FormField>
                      <FormField label="Service name"><Input name="name" required pattern="[A-Za-z0-9_\-]+" autoFocus /></FormField>
                      <FormField label="Desired tasks"><Input name="desired" type="number" min={0} defaultValue={1} /></FormField>
                      <FormField label="Launch type"><Select name="launchType" defaultValue="FARGATE"><option>FARGATE</option><option>EC2</option></Select></FormField>
                      <p className="text-sm text-muted">Networking uses the default VPC subnets and security group.</p>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!taskDefs.length}>Create</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Services
            </Header>
          }
        >
          <form id="svc-form" />
          <Table
            formId="svc-form"
            selection="multi"
            rows={services}
            rowKey={(s) => s.serviceArn!}
            columns={[
              { header: "Service name", cell: (s) => s.serviceName },
              { header: "Status", cell: (s) => s.status },
              { header: "Task definition", cell: (s) => short(s.taskDefinition) },
              { header: "Tasks", cell: (s) => `${s.runningCount ?? 0}/${s.desiredCount ?? 0} running`, sortValue: (s) => s.runningCount ?? 0 },
              { header: "Launch type", cell: (s) => s.launchType ?? "-" },
              { header: "Created", cell: (s) => formatDate(s.createdAt) },
            ]}
            empty={<EmptyState title="No services" description={taskDefs.length ? undefined : "Register a task definition first."} />}
          />
        </Container>
      ) : (
        <Container
          noPadding
          header={
            <Header
              counter={tasks.length}
              actions={
                <>
                  <ConfirmAction formId="tasks-form" action={stopTasks} extra={{ cluster: name }} label="Stop" title="Stop tasks" noun="task" confirmWord="stop" confirmLabel="Stop" />
                  <ModalButton label="Run new task" title="Run task" variant="primary">
                    <form action={runTask} className="space-y-4">
                      {hidden}
                      <FormField label="Task definition">{tdSelect}</FormField>
                      <FormField label="Desired tasks"><Input name="count" type="number" min={1} max={10} defaultValue={1} /></FormField>
                      <FormField label="Launch type"><Select name="launchType" defaultValue="FARGATE"><option>FARGATE</option><option>EC2</option></Select></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!taskDefs.length}>Create</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Tasks
            </Header>
          }
        >
          <form id="tasks-form" />
          <Table
            formId="tasks-form"
            selection="multi"
            rows={tasks}
            rowKey={(t) => t.taskArn!}
            columns={[
              { header: "Task", cell: (t) => <span className="font-mono text-xs">{short(t.taskArn)}</span> },
              { header: "Last status", cell: (t) => taskStatus(t.lastStatus) },
              { header: "Desired status", cell: (t) => t.desiredStatus },
              { header: "Task definition", cell: (t) => short(t.taskDefinitionArn) },
              { header: "Started by", cell: (t) => t.startedBy ?? "-" },
              { header: "Launch type", cell: (t) => t.launchType ?? "-" },
              { header: "Started at", cell: (t) => formatDate(t.startedAt ?? t.createdAt) },
            ]}
            empty={<EmptyState title="No tasks" />}
          />
        </Container>
      )}
    </Page>
  );
}
