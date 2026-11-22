import { DescribePlacementGroupsCommand, type PlacementGroup } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { createPlacementGroup, deletePlacementGroups } from "../actions";
import { ResourceState } from "../util";

export const metadata = { title: "Placement groups | EC2" };

export default async function PlacementGroupsPage() {
  let groups: PlacementGroup[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    groups = (await ec2.send(new DescribePlacementGroupsCommand({}))).PlacementGroups ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <Header
            variant="h1"
            counter={groups.length}
            info
            description="Control how instances are placed on underlying hardware: cluster, spread or partition."
            actions={
              <>
                <ConfirmAction formId="pg-form" action={deletePlacementGroups} label="Delete" title="Delete placement group" noun="placement group" />
                <ModalButton label="Create placement group" title="Create placement group" variant="primary">
                  <form action={createPlacementGroup} className="space-y-4">
                    <FormField label="Name"><Input name="name" required maxLength={255} /></FormField>
                    <FormField label="Placement strategy">
                      <Select name="strategy" defaultValue="cluster">
                        <option value="cluster">Cluster</option>
                        <option value="spread">Spread</option>
                        <option value="partition">Partition</option>
                      </Select>
                    </FormField>
                    <FormField label="Number of partitions" constraint="Partition strategy only, 1 to 7."><Input name="partitions" type="number" min={1} max={7} defaultValue={2} /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create group</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Placement groups
          </Header>
        }
      >
        <form id="pg-form" />
        <Table
          formId="pg-form"
          selection="multi"
          rows={groups}
          rowKey={(g) => g.GroupName!}
          columns={[
            { header: "Group name", cell: (g) => g.GroupName },
            { header: "Group ID", cell: (g) => <span className="font-mono text-[13px]">{g.GroupId}</span> },
            { header: "Strategy", cell: (g) => g.Strategy },
            { header: "Partitions", cell: (g) => g.PartitionCount ?? "–" },
            { header: "State", cell: (g) => <ResourceState state={g.State} /> },
          ]}
          empty={<EmptyState title="No placement groups" />}
        />
      </Container>
    </Page>
  );
}
