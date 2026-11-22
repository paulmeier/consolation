import Link from "next/link";
import { DescribeImagesCommand, DescribeInstanceAttributeCommand, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVolumesCommand, type Volume } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Table } from "@/components/table";
import { ModalButton } from "@/components/client/modal";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, Textarea, buttonClass } from "@/components/ui";
import { changeInstanceType, changeSecurityGroups, createImage, editUserData, instanceStateAction, setTerminationProtection } from "../../actions";
import { Ec2Tags, INSTANCE_TYPES, ResourceState, nameTag } from "../../util";
import { InstanceConnect } from "./connect";

const TABS = [
  { id: "details", label: "Details" },
  { id: "security", label: "Security" },
  { id: "networking", label: "Networking" },
  { id: "storage", label: "Storage" },
  { id: "tags", label: "Tags" },
  { id: "connect", label: "Connect" },
];

export default async function InstancePage({ params, searchParams }: PageProps<"/ec2/instances/[id]">) {
  const id = (await params).id;
  const t = String((await searchParams).tab ?? "details");
  const tab = TABS.some((x) => x.id === t) ? t : "details";
  const { ec2 } = await aws();
  let inst;
  try {
    inst = (await ec2.send(new DescribeInstancesCommand({ InstanceIds: [id] }))).Reservations?.[0]?.Instances?.[0];
    if (!inst) throw new Error(`Instance ${id} not found.`);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{id}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  let userData = "";
  let protectedTermination = false;
  let volumes: Volume[] = [];
  let groups: { id: string; name: string }[] = [];
  let imageName = "";
  try {
    const [ud, term, img] = await Promise.all([
      ec2.send(new DescribeInstanceAttributeCommand({ InstanceId: id, Attribute: "userData" })).catch(() => null),
      ec2.send(new DescribeInstanceAttributeCommand({ InstanceId: id, Attribute: "disableApiTermination" })).catch(() => null),
      ec2.send(new DescribeImagesCommand({ ImageIds: [inst.ImageId!] })).catch(() => null),
    ]);
    userData = ud?.UserData?.Value ? Buffer.from(ud.UserData.Value, "base64").toString("utf8") : "";
    protectedTermination = term?.DisableApiTermination?.Value ?? false;
    imageName = img?.Images?.[0]?.Name ?? "";
    if (tab === "storage") volumes = (await ec2.send(new DescribeVolumesCommand({ Filters: [{ Name: "attachment.instance-id", Values: [id] }] }))).Volumes ?? [];
    if (tab === "security") groups = ((await ec2.send(new DescribeSecurityGroupsCommand({}))).SecurityGroups ?? []).map((g) => ({ id: g.GroupId!, name: g.GroupName! }));
  } catch {}
  const state = inst.State?.Name ?? "";
  const stopped = state === "stopped";
  const base = `/ec2/instances/${id}`;
  const field = <input type="hidden" name="instance" value={id} />;
  const name = nameTag(inst.Tags);

  const stateButton = (op: string, label: string, enabled: boolean) => (
    <form action={instanceStateAction}>
      {field}
      <input type="hidden" name="op" value={op} />
      <button className={buttonClass("normal")} disabled={!enabled}>{label}</button>
    </form>
  );

  let body: React.ReactNode = null;
  if (tab === "details") {
    body = (
      <>
        <Container header={<Header>Instance summary</Header>}>
          <KeyValue
            columns={3}
            items={[
              { label: "Instance ID", value: <span className="font-mono text-[13px]">{id}</span> },
              { label: "Instance state", value: <ResourceState state={state} /> },
              { label: "Instance type", value: inst.InstanceType },
              { label: "Public IPv4 address", value: inst.PublicIpAddress ?? "–" },
              { label: "Private IPv4 address", value: inst.PrivateIpAddress ?? "–" },
              { label: "Public DNS", value: inst.PublicDnsName || "–" },
              { label: "AMI ID", value: <Link className="text-accent hover:underline" href="/ec2/amis">{inst.ImageId}</Link> },
              { label: "AMI name", value: imageName || "–" },
              { label: "Key pair", value: inst.KeyName ?? "–" },
              { label: "Launch time", value: formatDate(inst.LaunchTime) },
              { label: "Platform", value: inst.PlatformDetails ?? "Linux/UNIX" },
              { label: "Architecture", value: inst.Architecture ?? "–" },
              { label: "Placement group", value: inst.Placement?.GroupName || "–" },
              { label: "IAM role", value: inst.IamInstanceProfile?.Arn?.split("/").pop() ?? "–" },
              { label: "Termination protection", value: protectedTermination ? "Enabled" : "Disabled" },
            ]}
          />
        </Container>
        <Container
          header={
            <Header
              description="Runs at first boot on a real instance. Change it only while the instance is stopped."
              actions={
                <ModalButton label="Edit user data" title="Edit user data" size="lg">
                  <form action={editUserData} className="space-y-4">
                    {field}
                    {!stopped && <p className="text-sm text-warning">Stop the instance before changing its user data.</p>}
                    <Textarea name="userData" rows={12} defaultValue={userData} />
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                  </form>
                </ModalButton>
              }
            >
              User data
            </Header>
          }
        >
          <pre className="max-h-72 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap">{userData || "No user data."}</pre>
        </Container>
      </>
    );
  } else if (tab === "security") {
    const current = inst.SecurityGroups ?? [];
    body = (
      <Container
        header={
          <Header
            actions={
              <ModalButton label="Change security groups" title="Change security groups">
                <form action={changeSecurityGroups} className="space-y-4">
                  {field}
                  <fieldset className="max-h-72 space-y-1 overflow-auto">
                    {groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="groups" value={g.id} defaultChecked={current.some((c) => c.GroupId === g.id)} className="accent-accent" /> {g.name} ({g.id})
                      </label>
                    ))}
                  </fieldset>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                </form>
              </ModalButton>
            }
          >
            Security details
          </Header>
        }
      >
        <KeyValue
          columns={2}
          items={[
            { label: "Owner ID", value: "000000000000" },
            { label: "Security groups", value: current.length ? current.map((g) => <Link key={g.GroupId} className="mr-3 text-accent hover:underline" href={`/ec2/security-groups/${g.GroupId}`}>{g.GroupId} ({g.GroupName})</Link>) : "–" },
          ]}
        />
      </Container>
    );
  } else if (tab === "networking") {
    body = (
      <Container noPadding header={<Header counter={inst.NetworkInterfaces?.length ?? 0}>Network interfaces</Header>}>
        <div className="px-5 pb-4">
          <KeyValue
            items={[
              { label: "VPC ID", value: inst.VpcId ?? "–" },
              { label: "Subnet ID", value: inst.SubnetId ?? "–" },
              { label: "Availability Zone", value: inst.Placement?.AvailabilityZone ?? "–" },
            ]}
          />
        </div>
        <Table
          rows={inst.NetworkInterfaces ?? []}
          rowKey={(n) => n.NetworkInterfaceId!}
          columns={[
            { header: "Interface ID", cell: (n) => <span className="font-mono text-[13px]">{n.NetworkInterfaceId}</span> },
            { header: "Device index", cell: (n) => n.Attachment?.DeviceIndex ?? "-" },
            { header: "Private IPv4", cell: (n) => n.PrivateIpAddress ?? "-" },
            { header: "Public IPv4", cell: (n) => n.Association?.PublicIp ?? "-" },
            { header: "MAC", cell: (n) => <span className="font-mono text-[13px]">{n.MacAddress}</span> },
          ]}
          empty={<EmptyState title="No network interfaces" />}
        />
      </Container>
    );
  } else if (tab === "storage") {
    body = (
      <Container noPadding header={<Header counter={volumes.length} description={`Root device: ${inst.RootDeviceName ?? "-"} (${inst.RootDeviceType ?? "ebs"})`}>Block devices</Header>}>
        <Table
          rows={volumes}
          rowKey={(v) => v.VolumeId!}
          columns={[
            { header: "Volume ID", cell: (v) => <Link className="text-accent hover:underline" href="/ec2/volumes">{v.VolumeId}</Link> },
            { header: "Device name", cell: (v) => v.Attachments?.find((a) => a.InstanceId === id)?.Device },
            { header: "Size", cell: (v) => `${v.Size} GiB` },
            { header: "Type", cell: (v) => v.VolumeType },
            { header: "State", cell: (v) => <ResourceState state={v.State} /> },
            { header: "Delete on termination", cell: (v) => (v.Attachments?.find((a) => a.InstanceId === id)?.DeleteOnTermination ? "Yes" : "No") },
          ]}
          empty={<EmptyState title="No EBS volumes attached" description="Attach a volume from Elastic Block Store > Volumes." />}
        />
      </Container>
    );
  } else if (tab === "tags") {
    body = <Ec2Tags id={id} tags={inst.Tags} path={`${base}?tab=tags`} />;
  } else {
    body = (
      <Container header={<Header description="Push a one-time SSH public key for EC2 Instance Connect or the serial console.">Connect to instance</Header>}>
        <InstanceConnect instance={id} az={inst.Placement?.AvailabilityZone} />
      </Container>
    );
  }

  return (
    <Page wide>
      <Header
        variant="h1"
        description={name ? `Instance ${id}` : undefined}
        actions={
          <>
            {stateButton("start", "Start instance", state === "stopped")}
            {stateButton("stop", "Stop instance", state === "running")}
            {stateButton("reboot", "Reboot instance", state === "running")}
            <ConfirmAction action={instanceStateAction} values={[id]} extra={{ instance: id, op: "terminate" }} label="Terminate instance" title="Terminate (delete) instance?" noun="instance" confirmLabel="Terminate (delete)" />
            <ModalButton label="Change instance type" title="Change instance type">
              <form action={changeInstanceType} className="space-y-4">
                {field}
                {!stopped && <p className="text-sm text-warning">The instance must be stopped to change its type.</p>}
                <FormField label="New instance type">
                  <Select name="type" defaultValue={inst.InstanceType}>{INSTANCE_TYPES.map((x) => <option key={x}>{x}</option>)}</Select>
                </FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Apply</button></div>
              </form>
            </ModalButton>
            <form action={setTerminationProtection}>
              {field}
              <input type="hidden" name="on" value={String(!protectedTermination)} />
              <button className={buttonClass("normal")}>{protectedTermination ? "Disable" : "Enable"} termination protection</button>
            </form>
            <ModalButton label="Create image" title="Create image" variant="primary">
              <form action={createImage} className="space-y-4">
                {field}
                <FormField label="Image name"><Input name="name" required defaultValue={`${name ?? id}-image`} /></FormField>
                <FormField label={<>Image description <i className="font-normal text-muted">- optional</i></>}><Input name="description" /></FormField>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="noReboot" className="accent-accent" /> No reboot</label>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Create image</button></div>
              </form>
            </ModalButton>
          </>
        }
      >
        {name ? `${name}` : id}
      </Header>
      <Tabs base={base} active={tab} tabs={TABS} />
      {body}
    </Page>
  );
}
