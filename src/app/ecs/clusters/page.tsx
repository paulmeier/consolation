import Link from "next/link";
import { DescribeClustersCommand, ListClustersCommand, type Cluster } from "@aws-sdk/client-ecs";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, buttonClass } from "@/components/ui";
import { createCluster, deleteClusters } from "../actions";

export const metadata = { title: "Clusters | ECS" };

export default async function ClustersPage() {
  let clusters: Cluster[] = [];
  let error: string | null = null;
  try {
    const { ecs } = await aws();
    const arns = (await ecs.send(new ListClustersCommand({ maxResults: 100 }))).clusterArns ?? [];
    if (arns.length) clusters = (await ecs.send(new DescribeClustersCommand({ clusters: arns, include: ["SETTINGS"] }))).clusters ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              counter={clusters.length}
              info
              actions={
                <>
                  <LinkButton href="/ecs/clusters" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                  <ConfirmAction formId="clusters-form" action={deleteClusters} label="Delete cluster" title="Delete cluster" noun="cluster" confirmWord="delete" description="Delete the cluster's services first." />
                  <ModalButton label="Create cluster" title="Create cluster" variant="primary">
                    <form action={createCluster} className="space-y-4">
                      <FormField label="Cluster name" constraint="Up to 255 letters, numbers, hyphens, and underscores."><Input name="name" required maxLength={255} pattern="[A-Za-z0-9_\-]+" autoFocus /></FormField>
                      <p className="text-sm text-muted">Infrastructure: AWS Fargate (serverless).</p>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="insights" className="accent-accent" /> Use Container Insights</label>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Clusters
            </Header>
            <TableFilter tableId="clusters-table" placeholder="Search clusters" />
          </div>
        }
      >
        <form id="clusters-form" />
        {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
        <Table
          id="clusters-table"
          formId="clusters-form"
          selection="single"
          rows={clusters}
          rowKey={(c) => c.clusterName!}
          filterText={(c) => c.clusterName!}
          columns={[
            { header: "Cluster", cell: (c) => <Link className="underline-link" href={`/ecs/clusters/${encodeURIComponent(c.clusterName!)}`}>{c.clusterName}</Link> },
            { header: "Services", cell: (c) => c.activeServicesCount ?? 0, sortValue: (c) => c.activeServicesCount ?? 0 },
            { header: "Tasks", cell: (c) => `${c.pendingTasksCount ?? 0} Pending | ${c.runningTasksCount ?? 0} Running` },
            { header: "Container instances", cell: (c) => c.registeredContainerInstancesCount ?? 0 },
            { header: "Status", cell: (c) => c.status },
            { header: "Container Insights", cell: (c) => (c.settings?.find((s) => s.name === "containerInsights")?.value === "enabled" ? "On" : "Off") },
          ]}
          empty={<EmptyState title="No clusters" />}
        />
      </Container>
    </Page>
  );
}
