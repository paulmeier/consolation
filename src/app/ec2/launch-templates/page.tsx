import Link from "next/link";
import { DescribeImagesCommand, DescribeKeyPairsCommand, DescribeLaunchTemplatesCommand, DescribeSecurityGroupsCommand, type Image, type LaunchTemplate } from "@aws-sdk/client-ec2";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, buttonClass } from "@/components/ui";
import { createLaunchTemplate, deleteLaunchTemplates } from "../actions";
import { TemplateFields } from "../template-fields";

export const metadata = { title: "Launch templates | EC2" };

export default async function LaunchTemplatesPage() {
  let templates: LaunchTemplate[] = [];
  let images: Image[] = [];
  let keys: string[] = [];
  let groups: { id: string; name: string }[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    const [t, img, own, kp, sg] = await Promise.all([
      ec2.send(new DescribeLaunchTemplatesCommand({})),
      ec2.send(new DescribeImagesCommand({ Owners: ["amazon"], MaxResults: 50 })),
      ec2.send(new DescribeImagesCommand({ Owners: ["self"] })).catch(() => ({ Images: [] })),
      ec2.send(new DescribeKeyPairsCommand({})),
      ec2.send(new DescribeSecurityGroupsCommand({})),
    ]);
    templates = t.LaunchTemplates ?? [];
    images = [...(own.Images ?? []), ...(img.Images ?? [])];
    keys = (kp.KeyPairs ?? []).map((k) => k.KeyName!);
    groups = (sg.SecurityGroups ?? []).map((g) => ({ id: g.GroupId!, name: g.GroupName! }));
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
            counter={templates.length}
            info
            description="Launch templates store instance settings so you can launch instances without re-entering them."
            actions={
              <>
                <ConfirmAction formId="lt-form" action={deleteLaunchTemplates} label="Delete template" title="Delete launch template" noun="launch template" />
                <ModalButton label="Create launch template" title="Create launch template" variant="primary" size="lg">
                  <form action={createLaunchTemplate} className="space-y-4">
                    <FormField label="Launch template name" constraint="3 to 128 letters, numbers and ()./_- characters.">
                      <Input name="name" required pattern="[A-Za-z0-9()./_\-]{3,128}" />
                    </FormField>
                    <TemplateFields images={images} keys={keys} groups={groups} />
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create launch template</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Launch templates
          </Header>
        }
      >
        <form id="lt-form" />
        <Table
          formId="lt-form"
          selection="multi"
          rows={templates}
          rowKey={(t) => t.LaunchTemplateId!}
          columns={[
            { header: "Launch template ID", cell: (t) => <Link className="font-mono text-[13px] text-accent hover:underline" href={`/ec2/launch-templates/${t.LaunchTemplateId}`}>{t.LaunchTemplateId}</Link> },
            { header: "Launch template name", cell: (t) => t.LaunchTemplateName },
            { header: "Default version", cell: (t) => t.DefaultVersionNumber },
            { header: "Latest version", cell: (t) => t.LatestVersionNumber },
            { header: "Create time", cell: (t) => formatDate(t.CreateTime) },
          ]}
          empty={<EmptyState title="No launch templates" />}
        />
      </Container>
    </Page>
  );
}
