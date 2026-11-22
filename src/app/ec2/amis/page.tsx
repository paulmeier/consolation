import { DescribeImagesCommand, type Image } from "@aws-sdk/client-ec2";
import Link from "next/link";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, Select, buttonClass } from "@/components/ui";
import { copyImage, deregisterImages, launchFromImage } from "../actions";
import { ResourceState } from "../util";

export const metadata = { title: "AMIs | EC2" };

export default async function AmisPage({ searchParams }: PageProps<"/ec2/amis">) {
  const owner = (await searchParams).owner === "amazon" ? "amazon" : "self";
  let images: Image[] = [];
  let error: string | null = null;
  try {
    const { ec2 } = await aws();
    images = (await ec2.send(new DescribeImagesCommand({ Owners: [owner] }))).Images ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page wide>
      {error && <ErrorAlert message={error} />}
      <Container
        noPadding
        header={
          <div className="space-y-3">
            <Header
              variant="h1"
              counter={images.length}
              info
              description="Amazon Machine Images. Create one from an instance with Create image on the instance's page."
              actions={
                <>
                  {owner === "self" && <ConfirmAction formId="ami-form" action={deregisterImages} label="Deregister AMI" title="Deregister AMI" noun="AMI" confirmWord="deregister" confirmLabel="Deregister" />}
                  <ModalButton label="Copy AMI" title="Copy AMI">
                    <form action={copyImage} className="space-y-4">
                      <FormField label="Source AMI">
                        <Select name="image">{images.map((i) => <option key={i.ImageId} value={i.ImageId}>{i.Name} ({i.ImageId})</option>)}</Select>
                      </FormField>
                      <FormField label="Name for the copy"><Input name="name" required /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")} disabled={!images.length}>Copy AMI</button></div>
                    </form>
                  </ModalButton>
                  <button form="ami-form" formAction={launchFromImage} className={`${buttonClass("primary")} needs-selection`}>Launch instance from AMI</button>
                </>
              }
            >
              Amazon Machine Images (AMIs)
            </Header>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex overflow-hidden rounded border border-control-border text-sm">
                <Link href="/ec2/amis" className={owner === "self" ? "bg-primary px-3 py-[3px] text-on-primary" : "px-3 py-[3px] hover:bg-hover"}>Owned by me</Link>
                <Link href="/ec2/amis?owner=amazon" className={owner === "amazon" ? "bg-primary px-3 py-[3px] text-on-primary" : "px-3 py-[3px] hover:bg-hover"}>Amazon images</Link>
              </div>
              <div className="min-w-60 flex-1"><TableFilter tableId="ami-table" placeholder="Find AMI by attribute" /></div>
            </div>
          </div>
        }
      >
        <form id="ami-form" />
        <Table
          id="ami-table"
          formId="ami-form"
          selection={owner === "self" ? "multi" : "single"}
          rows={images}
          rowKey={(i) => i.ImageId!}
          filterText={(i) => `${i.Name} ${i.ImageId} ${i.Description}`}
          columns={[
            { header: "Name", cell: (i) => i.Name ?? "–" },
            { header: "AMI ID", cell: (i) => <span className="font-mono text-[13px]">{i.ImageId}</span> },
            { header: "Source", cell: (i) => i.ImageLocation ?? "–" },
            { header: "Owner", cell: (i) => i.ImageOwnerAlias ?? i.OwnerId },
            { header: "Visibility", cell: (i) => (i.Public ? "Public" : "Private") },
            { header: "Status", cell: (i) => <ResourceState state={i.State} /> },
            { header: "Creation date", cell: (i) => formatDate(i.CreationDate) },
            { header: "Platform", cell: (i) => i.PlatformDetails ?? "Linux/UNIX" },
            { header: "Root device", cell: (i) => i.RootDeviceType },
          ]}
          empty={<EmptyState title="No AMIs" description={owner === "self" ? "You don't own any AMIs. Create one from an instance." : "No images."} />}
        />
      </Container>
    </Page>
  );
}
