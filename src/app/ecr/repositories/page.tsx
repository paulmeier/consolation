import Link from "next/link";
import { Suspense } from "react";
import { DescribeRepositoriesCommand, type Repository } from "@aws-sdk/client-ecr";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { TableFilter } from "@/components/client/table-filter";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, LinkButton, RefreshIcon, Select, buttonClass } from "@/components/ui";
import { createRepository, deleteRepositories } from "../actions";

export const metadata = { title: "Repositories | ECR" };

async function Repos() {
  let repos: Repository[] = [];
  let error: string | null = null;
  try {
    const { ecr } = await aws();
    repos = (await ecr.send(new DescribeRepositoriesCommand({ maxResults: 1000 }))).repositories ?? [];
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Container
      noPadding
      header={
        <div className="space-y-3">
          <Header
            counter={repos.length}
            info
            actions={
              <>
                <LinkButton href="/ecr/repositories" aria-label="Refresh" className="px-2"><RefreshIcon /></LinkButton>
                <ConfirmAction formId="repos-form" action={deleteRepositories} label="Delete" title="Delete repositories" noun="repository" confirmWord="delete" description="Deleting a repository also deletes all of its images." />
                <ModalButton label="Create repository" title="Create private repository" variant="primary">
                  <form action={createRepository} className="space-y-4">
                    <FormField label="Repository name" description="000000000000.dkr.ecr.us-east-1.amazonaws.com/" constraint="2–256 characters: lowercase letters, numbers, hyphens, underscores, periods and forward slashes.">
                      <Input name="name" required minLength={2} maxLength={256} pattern="[a-z0-9]+([._\-\/][a-z0-9]+)*" autoFocus />
                    </FormField>
                    <FormField label="Image tag mutability">
                      <Select name="mutability" defaultValue="MUTABLE"><option value="MUTABLE">Mutable</option><option value="IMMUTABLE">Immutable</option></Select>
                    </FormField>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="scanOnPush" className="accent-accent" /> Scan on push</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="kms" className="accent-accent" /> Encrypt with AWS KMS (default AES-256)</label>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Create</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Private repositories
          </Header>
          <TableFilter tableId="repos-table" placeholder="Search repositories" />
        </div>
      }
    >
      <form id="repos-form" />
      {error && <div className="px-5 pb-4"><ErrorAlert message={error} /></div>}
      <Table
        id="repos-table"
        formId="repos-form"
        selection="multi"
        rows={repos}
        rowKey={(r) => r.repositoryName!}
        filterText={(r) => r.repositoryName!}
        columns={[
          { header: "Repository name", cell: (r) => <Link className="underline-link" href={`/ecr/repositories/${encodeURIComponent(r.repositoryName!)}`}>{r.repositoryName}</Link> },
          { header: "URI", cell: (r) => <span className="font-mono text-[13px] break-all">{r.repositoryUri}</span> },
          { header: "Created at", cell: (r) => formatDate(r.createdAt) },
          { header: "Tag immutability", cell: (r) => (r.imageTagMutability === "IMMUTABLE" ? "Enabled" : "Disabled") },
          { header: "Scan on push", cell: (r) => (r.imageScanningConfiguration?.scanOnPush ? "Enabled" : "Disabled") },
          { header: "Encryption type", cell: (r) => r.encryptionConfiguration?.encryptionType ?? "AES256" },
        ]}
        empty={<EmptyState title="No repositories" description="No repositories to display." />}
      />
    </Container>
  );
}

export default function ReposPage() {
  return (
    <Page>
      <Suspense fallback={<Container header={<Header>Private repositories</Header>}>Loading…</Container>}>
        <Repos />
      </Suspense>
    </Page>
  );
}
