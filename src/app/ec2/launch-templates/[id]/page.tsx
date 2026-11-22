import {
  DescribeImagesCommand,
  DescribeKeyPairsCommand,
  DescribeLaunchTemplatesCommand,
  DescribeLaunchTemplateVersionsCommand,
  DescribeSecurityGroupsCommand,
  type LaunchTemplateVersion,
} from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Badge, Container, ErrorAlert, FormField, Header, Input, KeyValue, Select, buttonClass } from "@/components/ui";
import { createLaunchTemplateVersion, deleteLaunchTemplates, launchFromTemplate, setDefaultTemplateVersion } from "../../actions";
import { TemplateFields } from "../../template-fields";

export default async function LaunchTemplatePage({ params }: PageProps<"/ec2/launch-templates/[id]">) {
  const id = (await params).id;
  const { ec2 } = await aws();
  let data;
  try {
    const [t, v, img, own, kp, sg] = await Promise.all([
      ec2.send(new DescribeLaunchTemplatesCommand({ LaunchTemplateIds: [id] })),
      ec2.send(new DescribeLaunchTemplateVersionsCommand({ LaunchTemplateId: id })),
      ec2.send(new DescribeImagesCommand({ Owners: ["amazon"], MaxResults: 50 })),
      ec2.send(new DescribeImagesCommand({ Owners: ["self"] })).catch(() => ({ Images: [] })),
      ec2.send(new DescribeKeyPairsCommand({})),
      ec2.send(new DescribeSecurityGroupsCommand({})),
    ]);
    data = {
      template: t.LaunchTemplates?.[0],
      versions: (v.LaunchTemplateVersions ?? []).sort((a, b) => (b.VersionNumber ?? 0) - (a.VersionNumber ?? 0)),
      images: [...(own.Images ?? []), ...(img.Images ?? [])],
      keys: (kp.KeyPairs ?? []).map((k) => k.KeyName!),
      groups: (sg.SecurityGroups ?? []).map((g) => ({ id: g.GroupId!, name: g.GroupName! })),
    };
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{id}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const t = data.template;
  const def = data.versions.find((v) => v.DefaultVersion) ?? data.versions[0];
  const ld = (v?: LaunchTemplateVersion) => v?.LaunchTemplateData;
  const field = <input type="hidden" name="template" value={id} />;
  return (
    <Page wide>
      <Header
        variant="h1"
        actions={
          <>
            <ConfirmAction action={deleteLaunchTemplates} values={[id]} extra={{ redirect: "1" }} label="Delete template" title="Delete launch template" noun="launch template" />
            <ModalButton label="Modify template (Create new version)" title="Create new template version" size="lg">
              <form action={createLaunchTemplateVersion} className="space-y-4">
                {field}
                <FormField label="Source template version">
                  <Select name="source" defaultValue={String(def?.VersionNumber ?? "")}>{data.versions.map((v) => <option key={v.VersionNumber} value={v.VersionNumber}>{v.VersionNumber}{v.DefaultVersion ? " (Default)" : ""}</option>)}</Select>
                </FormField>
                <TemplateFields
                  images={data.images}
                  keys={data.keys}
                  groups={data.groups}
                  initial={{
                    ami: ld(def)?.ImageId,
                    type: ld(def)?.InstanceType,
                    key: ld(def)?.KeyName,
                    groups: ld(def)?.SecurityGroupIds,
                    userData: ld(def)?.UserData ? Buffer.from(ld(def)!.UserData!, "base64").toString("utf8") : "",
                  }}
                />
                <div className="flex justify-end"><button className={buttonClass("primary")}>Create template version</button></div>
              </form>
            </ModalButton>
            <ModalButton label="Launch instance from template" title="Launch instance from template" variant="primary">
              <form action={launchFromTemplate} className="space-y-4">
                {field}
                <FormField label="Template version">
                  <Select name="version" defaultValue="$Default">
                    <option value="$Default">Default ({def?.VersionNumber})</option>
                    <option value="$Latest">Latest ({t?.LatestVersionNumber})</option>
                    {data.versions.map((v) => <option key={v.VersionNumber} value={v.VersionNumber}>{v.VersionNumber}</option>)}
                  </Select>
                </FormField>
                <FormField label="Number of instances"><Input name="count" type="number" min={1} max={10} defaultValue={1} /></FormField>
                <div className="flex justify-end"><button className={buttonClass("primary")}>Launch instance</button></div>
              </form>
            </ModalButton>
          </>
        }
      >
        {t?.LaunchTemplateName ?? id}
      </Header>
      <Container header={<Header>Launch template details</Header>}>
        <KeyValue
          columns={4}
          items={[
            { label: "Launch template ID", value: <span className="font-mono text-[13px]">{id}</span> },
            { label: "Default version", value: String(t?.DefaultVersionNumber) },
            { label: "Latest version", value: String(t?.LatestVersionNumber) },
            { label: "Created", value: formatDate(t?.CreateTime) },
            { label: "AMI ID", value: ld(def)?.ImageId ?? "–" },
            { label: "Instance type", value: ld(def)?.InstanceType ?? "–" },
            { label: "Key pair", value: ld(def)?.KeyName ?? "–" },
            { label: "Security groups", value: ld(def)?.SecurityGroupIds?.join(", ") || "–" },
          ]}
        />
      </Container>
      <Container noPadding header={<Header counter={data.versions.length} actions={<button form="ver-form" className={`${buttonClass("normal")} needs-selection`}>Set default version</button>}>Versions</Header>}>
        <form id="ver-form" action={setDefaultTemplateVersion}>{field}</form>
        <Table
          formId="ver-form"
          selection="single"
          rows={data.versions}
          rowKey={(v) => String(v.VersionNumber)}
          columns={[
            { header: "Version", cell: (v) => <>{v.VersionNumber} {v.DefaultVersion && <Badge color="blue">Default</Badge>}</> },
            { header: "Description", cell: (v) => v.VersionDescription || "–" },
            { header: "AMI", cell: (v) => v.LaunchTemplateData?.ImageId ?? "–" },
            { header: "Instance type", cell: (v) => v.LaunchTemplateData?.InstanceType ?? "–" },
            { header: "Created", cell: (v) => formatDate(v.CreateTime) },
          ]}
        />
      </Container>
    </Page>
  );
}
