import { DescribeSpotInstanceRequestsCommand, type SpotInstanceRequest } from "@aws-sdk/client-ec2";
import Link from "next/link";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Container, EmptyState, ErrorAlert, Header } from "@/components/ui";
import { ResourceState } from "../util";

export const metadata = { title: "Spot Requests | EC2" };

export default async function SpotRequestsPage() {
  let rows: SpotInstanceRequest[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    rows = (await ec2.send(new DescribeSpotInstanceRequestsCommand({}))).SpotInstanceRequests ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container noPadding header={<Header variant="h1" counter={rows.length} description="Read-only. Spot requests made through the API appear here.">Spot Requests</Header>}>
        <Table
          rows={rows}
          rowKey={(r) => r.SpotInstanceRequestId!}
          columns={[
            { header: "Request ID", cell: (r) => <span className="font-mono text-[13px]">{r.SpotInstanceRequestId}</span> },
            { header: "Request type", cell: (r) => r.Type },
            { header: "Instance type", cell: (r) => r.LaunchSpecification?.InstanceType },
            { header: "State", cell: (r) => <ResourceState state={r.State} /> },
            { header: "Status", cell: (r) => r.Status?.Code ?? "–" },
            { header: "Instance", cell: (r) => (r.InstanceId ? <Link className="text-accent hover:underline" href={`/ec2/instances/${r.InstanceId}`}>{r.InstanceId}</Link> : "–") },
            { header: "Max price", cell: (r) => r.SpotPrice ?? "On-Demand price" },
            { header: "Created", cell: (r) => formatDate(r.CreateTime) },
          ]}
          empty={<EmptyState title="No Spot requests" />}
        />
      </Container>
    </Page>
  );
}
