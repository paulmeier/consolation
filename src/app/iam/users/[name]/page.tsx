import { GetUserCommand, ListAccessKeysCommand, ListAttachedUserPoliciesCommand } from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { Container, EmptyState, ErrorAlert, Header, KeyValue, StatusIndicator } from "@/components/ui";
import { deleteAccessKeys } from "../../actions";
import { CreateAccessKey } from "../../access-key-button";
import { AttachedPolicies } from "../../attached-policies";

export default async function UserPage({ params }: PageProps<"/iam/users/[name]">) {
  const name = decodeURIComponent((await params).name);
  let data;
  try {
    const { iam } = await aws();
    data = await Promise.all([
      iam.send(new GetUserCommand({ UserName: name })),
      iam.send(new ListAccessKeysCommand({ UserName: name })),
      iam.send(new ListAttachedUserPoliciesCommand({ UserName: name })),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [user, keys, pols] = data;
  const u = user.User!;
  return (
    <Page>
      <Header variant="h1" info>{name}</Header>
      <Container header={<Header>Summary</Header>}>
        <KeyValue
          items={[
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{u.Arn}</span> },
            { label: "Created", value: formatDate(u.CreateDate) },
            { label: "User ID", value: <span className="font-mono text-[13px]">{u.UserId}</span> },
          ]}
        />
      </Container>
      <AttachedPolicies kind="user" principal={name} policies={pols.AttachedPolicies ?? []} />
      <Container
        noPadding
        header={
          <Header
            counter={keys.AccessKeyMetadata?.length ?? 0}
            description="Use access keys to send programmatic calls to the emulator from the AWS CLI or SDKs."
            actions={<ConfirmAction formId="keys-form" action={deleteAccessKeys} extra={{ user: name }} label="Delete" title="Delete access key" noun="access key" confirmWord="delete" />}
          >
            Access keys
          </Header>
        }
      >
        <form id="keys-form" />
        <Table
          formId="keys-form"
          selection="single"
          rows={keys.AccessKeyMetadata ?? []}
          rowKey={(k) => k.AccessKeyId!}
          columns={[
            { header: "Access key ID", cell: (k) => <span className="font-mono text-[13px]">{k.AccessKeyId}</span> },
            { header: "Status", cell: (k) => (k.Status === "Active" ? <StatusIndicator type="success">Active</StatusIndicator> : <StatusIndicator type="stopped">Inactive</StatusIndicator>) },
            { header: "Created", cell: (k) => formatDate(k.CreateDate) },
          ]}
          empty={<EmptyState title="No access keys" />}
        />
        <div className="px-5 py-4">
          <CreateAccessKey user={name} />
        </div>
      </Container>
    </Page>
  );
}
