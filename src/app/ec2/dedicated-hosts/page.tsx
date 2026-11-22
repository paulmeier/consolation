import { DescribeHostsCommand, type Host } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Container, EmptyState, ErrorAlert, Header } from "@/components/ui";
import { ResourceState, nameTag } from "../util";

export const metadata = { title: "Dedicated Hosts | EC2" };

export default async function DedicatedHostsPage() {
  let rows: Host[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    rows = (await ec2.send(new DescribeHostsCommand({}))).Hosts ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container noPadding header={<Header variant="h1" counter={rows.length} description="Read-only. Hosts allocated through the API (AllocateHosts) appear here.">Dedicated Hosts</Header>}>
        <Table
          rows={rows}
          rowKey={(h) => h.HostId!}
          columns={[
            { header: "Name", cell: (h) => nameTag(h.Tags) ?? "–" },
            { header: "Host ID", cell: (h) => <span className="font-mono text-[13px]">{h.HostId}</span> },
            { header: "Instance family / type", cell: (h) => h.HostProperties?.InstanceFamily ?? h.HostProperties?.InstanceType ?? "–" },
            { header: "Availability Zone", cell: (h) => h.AvailabilityZone },
            { header: "Instances", cell: (h) => h.Instances?.length ?? 0 },
            { header: "Auto placement", cell: (h) => h.AutoPlacement },
            { header: "State", cell: (h) => <ResourceState state={h.State} /> },
            { header: "Allocated", cell: (h) => formatDate(h.AllocationTime) },
          ]}
          empty={<EmptyState title="No Dedicated Hosts" />}
        />
      </Container>
    </Page>
  );
}
