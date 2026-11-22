import Link from "next/link";
import { Suspense } from "react";
import { DescribeInstancesCommand, type Instance } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, LinkButton, RefreshIcon, StatusIndicator } from "@/components/ui";
import { rebootInstances, startInstances, stopInstances, terminateInstances } from "../actions";

export const metadata = { title: "Instances | EC2" };
const FORM = "instances-form";

function state(s?: string) {
  switch (s) {
    case "running":
      return <StatusIndicator type="success">Running</StatusIndicator>;
    case "pending":
    case "stopping":
    case "shutting-down":
      return <StatusIndicator type="pending">{s.charAt(0).toUpperCase() + s.slice(1)}</StatusIndicator>;
    case "stopped":
      return <StatusIndicator type="stopped">Stopped</StatusIndicator>;
    case "terminated":
      return <StatusIndicator type="error">Terminated</StatusIndicator>;
    default:
      return s ?? "-";
  }
}

const nameOf = (i: Instance) => i.Tags?.find((t) => t.Key === "Name")?.Value ?? "–";

async function Instances() {
  let instances: Instance[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    const res = await ec2.send(new DescribeInstancesCommand({}));
    instances = (res.Reservations ?? []).flatMap((r) => r.Instances ?? []);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={instances.length}
            info
            actions={
              <>
                <LinkButton href="/ec2/instances" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId={FORM} action={startInstances} label="Start" title="Start instance?" noun="instance" confirmWord="start" confirmLabel="Start" />
                <ConfirmAction formId={FORM} action={stopInstances} label="Stop" title="Stop instance?" noun="instance" confirmWord="stop" confirmLabel="Stop" />
                <ConfirmAction formId={FORM} action={rebootInstances} label="Reboot" title="Reboot instance?" noun="instance" confirmWord="reboot" confirmLabel="Reboot" />
                <ConfirmAction formId={FORM} action={terminateInstances} label="Terminate" title="Terminate (delete) instance?" noun="instance" confirmWord="delete" confirmLabel="Terminate (delete)" description="On an EBS-backed instance, the default action is for the root EBS volume to be deleted when the instance is terminated." />
                <LinkButton href="/ec2/instances/launch" variant="primary">Launch instances</LinkButton>
              </>
            }
          >
            Instances
          </Header>
          <TableFilter tableId="instances-table" placeholder="Find Instance by attribute or tag (case-sensitive)" />
        </div>
      }
    >
      <form id={FORM} />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="instances-table"
        formId={FORM}
        selection="multi"
        rows={instances}
        rowKey={(i) => i.InstanceId!}
        filterText={(i) => `${nameOf(i)} ${i.InstanceId} ${i.InstanceType} ${i.State?.Name}`}
        columns={[
          { header: "Name", cell: nameOf },
          { header: "Instance ID", cell: (i) => <Link className="font-mono text-[13px] text-accent hover:underline" href={`/ec2/instances/${i.InstanceId}`}>{i.InstanceId}</Link> },
          { header: "Instance state", cell: (i) => state(i.State?.Name) },
          { header: "Instance type", cell: (i) => i.InstanceType },
          { header: "Availability Zone", cell: (i) => i.Placement?.AvailabilityZone ?? "-" },
          { header: "Private IPv4", cell: (i) => i.PrivateIpAddress ?? "–" },
          { header: "Public IPv4", cell: (i) => i.PublicIpAddress ?? "–" },
          { header: "Key name", cell: (i) => i.KeyName ?? "–" },
          { header: "Launch time", cell: (i) => formatDate(i.LaunchTime) },
        ]}
        empty={<EmptyState title="No instances" description="You do not have any instances in this region" action={<LinkButton href="/ec2/instances/launch">Launch instances</LinkButton>} />}
      />
    </Container>
  );
}

export default function InstancesPage() {
  return (
    <Page wide>
      <Suspense fallback={<Container header={<Header>Instances</Header>}>Loading instances…</Container>}>
        <Instances />
      </Suspense>
    </Page>
  );
}
