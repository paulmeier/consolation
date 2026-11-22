import { DescribeCapacityReservationsCommand, type CapacityReservation } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Container, EmptyState, ErrorAlert, Header } from "@/components/ui";
import { ResourceState } from "../util";

export const metadata = { title: "Capacity Reservations | EC2" };

export default async function CapacityReservationsPage() {
  let rows: CapacityReservation[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    rows = (await ec2.send(new DescribeCapacityReservationsCommand({}))).CapacityReservations ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container noPadding header={<Header variant="h1" counter={rows.length} description="Read-only. On-Demand Capacity Reservations created through the API appear here.">Capacity Reservations</Header>}>
        <Table
          rows={rows}
          rowKey={(r) => r.CapacityReservationId!}
          columns={[
            { header: "Capacity Reservation ID", cell: (r) => <span className="font-mono text-[13px]">{r.CapacityReservationId}</span> },
            { header: "Instance type", cell: (r) => r.InstanceType },
            { header: "Availability Zone", cell: (r) => r.AvailabilityZone },
            { header: "Platform", cell: (r) => r.InstancePlatform },
            { header: "Capacity", cell: (r) => `${r.AvailableInstanceCount ?? 0} available of ${r.TotalInstanceCount ?? 0}` },
            { header: "State", cell: (r) => <ResourceState state={r.State} /> },
            { header: "Start", cell: (r) => formatDate(r.StartDate) },
            { header: "End", cell: (r) => (r.EndDate ? formatDate(r.EndDate) : "Unlimited") },
          ]}
          empty={<EmptyState title="No Capacity Reservations" />}
        />
      </Container>
    </Page>
  );
}
