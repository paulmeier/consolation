import Link from "next/link";
import {
  GetLoginProfileCommand,
  GetUserCommand,
  GetUserPolicyCommand,
  ListAccessKeysCommand,
  ListAttachedUserPoliciesCommand,
  ListGroupsCommand,
  ListGroupsForUserCommand,
  ListServiceSpecificCredentialsCommand,
  ListSigningCertificatesCommand,
  ListSSHPublicKeysCommand,
  ListUserPoliciesCommand,
  ListUserTagsCommand,
  type AccessKeyMetadata,
  type Group,
  type ServiceSpecificCredentialMetadata,
  type SigningCertificate,
  type SSHPublicKeyMetadata,
  type Tag,
} from "@aws-sdk/client-iam";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Tabs } from "@/components/tabs";
import { Table } from "@/components/table";
import { TagsPanel } from "@/components/tags";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import {
  addUserToGroups,
  deleteAccessKeys,
  deleteLoginProfile,
  deleteServiceCredentials,
  deleteSigningCerts,
  deleteSshKeys,
  removeUserFromGroups,
  setAccessKeyStatus,
  setLoginProfile,
  tagIam,
  untagIam,
  uploadSigningCert,
  uploadSshKey,
} from "../../actions";
import { CreateAccessKey } from "../../access-key-button";
import { CreateServiceCredential } from "../../service-credential";
import { AttachedPolicies } from "../../attached-policies";
import { InlinePolicies } from "../../inline-policies";
import { PermissionsBoundary } from "../../boundary";
import { allPolicies, decodeDoc } from "../../policy-options";

const TABS = [
  { id: "permissions", label: "Permissions" },
  { id: "groups", label: "Groups" },
  { id: "tags", label: "Tags" },
  { id: "credentials", label: "Security credentials" },
];

export default async function UserPage({ params, searchParams }: PageProps<"/iam/users/[name]">) {
  const name = decodeURIComponent((await params).name);
  const t = String((await searchParams).tab ?? "permissions");
  const tab = TABS.some((x) => x.id === t) ? t : "permissions";
  const { iam } = await aws();
  let user;
  try {
    user = (await iam.send(new GetUserCommand({ UserName: name }))).User!;
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const d = {
    attached: [] as { PolicyArn?: string; PolicyName?: string }[],
    inline: [] as { name: string; doc: string }[],
    options: [] as Awaited<ReturnType<typeof allPolicies>>,
    groups: [] as Group[],
    allGroups: [] as Group[],
    tags: [] as Tag[],
    keys: [] as AccessKeyMetadata[],
    login: null as null | { created?: Date; reset?: boolean },
    ssh: [] as SSHPublicKeyMetadata[],
    svc: [] as ServiceSpecificCredentialMetadata[],
    certs: [] as SigningCertificate[],
  };
  let tabError: string | null = null;
  try {
    if (tab === "permissions") {
      const [att, names, options] = await Promise.all([
        iam.send(new ListAttachedUserPoliciesCommand({ UserName: name })),
        iam.send(new ListUserPoliciesCommand({ UserName: name })),
        allPolicies(iam),
      ]);
      d.attached = att.AttachedPolicies ?? [];
      d.options = options;
      d.inline = await Promise.all((names.PolicyNames ?? []).map(async (p) => ({ name: p, doc: decodeDoc((await iam.send(new GetUserPolicyCommand({ UserName: name, PolicyName: p }))).PolicyDocument) })));
    } else if (tab === "groups") {
      d.groups = (await iam.send(new ListGroupsForUserCommand({ UserName: name }))).Groups ?? [];
      d.allGroups = (await iam.send(new ListGroupsCommand({ MaxItems: 1000 }))).Groups ?? [];
    } else if (tab === "tags") {
      d.tags = (await iam.send(new ListUserTagsCommand({ UserName: name }))).Tags ?? [];
    } else {
      const [keys, ssh, svc, certs] = await Promise.all([
        iam.send(new ListAccessKeysCommand({ UserName: name })),
        iam.send(new ListSSHPublicKeysCommand({ UserName: name })),
        iam.send(new ListServiceSpecificCredentialsCommand({ UserName: name })).catch(() => ({ ServiceSpecificCredentials: [] })),
        iam.send(new ListSigningCertificatesCommand({ UserName: name })),
      ]);
      d.keys = keys.AccessKeyMetadata ?? [];
      d.ssh = ssh.SSHPublicKeys ?? [];
      d.svc = svc.ServiceSpecificCredentials ?? [];
      d.certs = certs.Certificates ?? [];
      try {
        const lp = (await iam.send(new GetLoginProfileCommand({ UserName: name }))).LoginProfile;
        d.login = lp ? { created: lp.CreateDate, reset: lp.PasswordResetRequired } : null;
      } catch {
        d.login = null; // NoSuchEntity: no console password
      }
    }
  } catch (e) {
    tabError = errorMessage(e);
  }
  const base = `/iam/users/${encodeURIComponent(name)}`;
  const userField = <input type="hidden" name="user" value={name} />;
  const otherGroups = d.allGroups.filter((g) => !d.groups.some((x) => x.GroupName === g.GroupName));

  let body: React.ReactNode = null;
  if (tab === "permissions") {
    body = (
      <>
        <AttachedPolicies kind="user" principal={name} policies={d.attached} options={d.options} />
        <InlinePolicies kind="user" principal={name} policies={d.inline} />
        <PermissionsBoundary kind="user" principal={name} arn={user.PermissionsBoundary?.PermissionsBoundaryArn} options={d.options} />
      </>
    );
  } else if (tab === "groups") {
    body = (
      <Container
        noPadding
        header={
          <Header
            counter={d.groups.length}
            description="The user gets the permissions of every group it belongs to."
            actions={
              <>
                <ConfirmAction formId="ugroups-form" action={removeUserFromGroups} extra={{ user: name }} label="Remove" title="Remove user from groups" noun="group" confirmWord="remove" confirmLabel="Remove" />
                <ModalButton label="Add user to groups" title="Add user to groups" variant="primary">
                  <form action={addUserToGroups} className="space-y-4">
                    {userField}
                    {otherGroups.length === 0 ? (
                      <p className="text-muted">No other groups. <Link className="text-accent hover:underline" href="/iam/groups">Create a group</Link> first.</p>
                    ) : (
                      <fieldset className="max-h-72 space-y-1 overflow-auto">
                        {otherGroups.map((g) => (
                          <label key={g.GroupName} className="flex items-center gap-2">
                            <input type="checkbox" name="groups" value={g.GroupName} className="accent-accent" /> {g.GroupName}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    <div className="flex justify-end"><button className={buttonClass("primary")} disabled={otherGroups.length === 0}>Add user to groups</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            User groups membership
          </Header>
        }
      >
        <form id="ugroups-form" />
        <Table
          formId="ugroups-form"
          selection="multi"
          rows={d.groups}
          rowKey={(g) => g.GroupName!}
          columns={[
            { header: "Group name", cell: (g) => <Link className="text-accent hover:underline" href={`/iam/groups/${encodeURIComponent(g.GroupName!)}`}>{g.GroupName}</Link> },
            { header: "Creation time", cell: (g) => formatDate(g.CreateDate) },
          ]}
          empty={<EmptyState title="No groups" description="This user doesn't belong to any groups." />}
        />
      </Container>
    );
  } else if (tab === "tags") {
    body = <TagsPanel tags={d.tags} addAction={tagIam} removeAction={untagIam} hidden={{ kind: "user", id: name }} />;
  } else {
    body = (
      <>
        <Container
          header={
            <Header
              description="A password lets the user sign in to the AWS Management Console. The emulator has no console sign-in."
              actions={
                <>
                  {d.login && (
                    <form action={deleteLoginProfile}>
                      {userField}
                      <button className={buttonClass("normal")}>Disable console access</button>
                    </form>
                  )}
                  <ModalButton label={d.login ? "Change password" : "Enable console access"} title="Console password">
                    <form action={setLoginProfile} className="space-y-4">
                      {userField}
                      {d.login && <input type="hidden" name="exists" value="1" />}
                      <FormField label="Password">
                        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
                      </FormField>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="reset" className="accent-accent" /> User must create a new password at next sign-in
                      </label>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              Console sign-in
            </Header>
          }
        >
          <KeyValue
            items={[
              { label: "Console access", value: d.login ? <StatusIndicator type="success">Enabled</StatusIndicator> : <StatusIndicator type="stopped">Disabled</StatusIndicator> },
              { label: "Password created", value: d.login ? formatDate(d.login.created) : "-" },
              { label: "Reset required", value: d.login ? (d.login.reset ? "Yes" : "No") : "-" },
            ]}
          />
        </Container>
        <Container
          noPadding
          header={
            <Header
              counter={d.keys.length}
              description="Use access keys to send programmatic calls to the emulator from the AWS CLI or SDKs. To rotate a key, create a new one, switch to it, then deactivate and delete the old one."
              actions={
                <>
                  <ConfirmAction formId="keys-form" action={deleteAccessKeys} extra={{ user: name }} label="Delete" title="Delete access key" noun="access key" />
                  <button form="keys-form" name="status" value="Inactive" className={`${buttonClass("normal")} needs-selection`}>Deactivate</button>
                  <button form="keys-form" name="status" value="Active" className={`${buttonClass("normal")} needs-selection`}>Activate</button>
                </>
              }
            >
              Access keys
            </Header>
          }
        >
          <form id="keys-form" action={setAccessKeyStatus}>{userField}</form>
          <Table
            formId="keys-form"
            selection="multi"
            rows={d.keys}
            rowKey={(k) => k.AccessKeyId!}
            columns={[
              { header: "Access key ID", cell: (k) => <span className="font-mono text-[13px]">{k.AccessKeyId}</span> },
              { header: "Status", cell: (k) => (k.Status === "Active" ? <StatusIndicator type="success">Active</StatusIndicator> : <StatusIndicator type="stopped">Inactive</StatusIndicator>) },
              { header: "Created", cell: (k) => formatDate(k.CreateDate) },
            ]}
            empty={<EmptyState title="No access keys" />}
          />
          <div className="px-5 py-4">
            {d.keys.length >= 2 ? <p className="text-sm text-muted">A user can have at most two access keys.</p> : <CreateAccessKey user={name} />}
          </div>
        </Container>
        <Container
          noPadding
          header={
            <Header
              counter={d.ssh.length}
              description="SSH public keys for AWS CodeCommit."
              actions={
                <>
                  <ConfirmAction formId="ssh-form" action={deleteSshKeys} extra={{ user: name }} label="Delete" title="Delete SSH public key" noun="SSH public key" />
                  <ModalButton label="Upload SSH public key" title="Upload SSH public key">
                    <form action={uploadSshKey} className="space-y-4">
                      {userField}
                      <FormField label="SSH public key" description="ssh-rsa key body in OpenSSH format, or a PEM public key.">
                        <Textarea name="key" rows={5} required />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Upload SSH public key</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              SSH public keys for AWS CodeCommit
            </Header>
          }
        >
          <form id="ssh-form" />
          <Table
            formId="ssh-form"
            selection="multi"
            rows={d.ssh}
            rowKey={(k) => k.SSHPublicKeyId!}
            columns={[
              { header: "SSH key ID", cell: (k) => <span className="font-mono text-[13px]">{k.SSHPublicKeyId}</span> },
              { header: "Status", cell: (k) => k.Status },
              { header: "Uploaded", cell: (k) => formatDate(k.UploadDate) },
            ]}
            empty={<EmptyState title="No SSH public keys" />}
          />
        </Container>
        <Container noPadding header={<Header counter={d.svc.length} description="User names and passwords for HTTPS Git and Amazon Keyspaces." actions={<ConfirmAction formId="svc-form" action={deleteServiceCredentials} extra={{ user: name }} label="Delete" title="Delete credentials" noun="credential" />}>Service-specific credentials</Header>}>
          <form id="svc-form" />
          <Table
            formId="svc-form"
            selection="multi"
            rows={d.svc}
            rowKey={(c) => c.ServiceSpecificCredentialId!}
            columns={[
              { header: "Service", cell: (c) => c.ServiceName },
              { header: "User name", cell: (c) => <span className="font-mono text-[13px]">{c.ServiceUserName}</span> },
              { header: "Status", cell: (c) => c.Status },
              { header: "Created", cell: (c) => formatDate(c.CreateDate) },
            ]}
            empty={<EmptyState title="No service-specific credentials" />}
          />
          <div className="px-5 py-4"><CreateServiceCredential user={name} /></div>
        </Container>
        <Container
          noPadding
          header={
            <Header
              counter={d.certs.length}
              description="X.509 certificates for SOAP-based APIs."
              actions={
                <>
                  <ConfirmAction formId="certs-form" action={deleteSigningCerts} extra={{ user: name }} label="Delete" title="Delete signing certificate" noun="certificate" />
                  <ModalButton label="Upload certificate" title="Upload X.509 signing certificate">
                    <form action={uploadSigningCert} className="space-y-4">
                      {userField}
                      <FormField label="Certificate body (PEM)">
                        <Textarea name="cert" rows={8} required placeholder="-----BEGIN CERTIFICATE-----" />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Upload certificate</button></div>
                    </form>
                  </ModalButton>
                </>
              }
            >
              X.509 signing certificates
            </Header>
          }
        >
          <form id="certs-form" />
          <Table
            formId="certs-form"
            selection="multi"
            rows={d.certs}
            rowKey={(c) => c.CertificateId!}
            columns={[
              { header: "Certificate ID", cell: (c) => <span className="font-mono text-[13px]">{c.CertificateId}</span> },
              { header: "Status", cell: (c) => c.Status },
              { header: "Uploaded", cell: (c) => formatDate(c.UploadDate) },
            ]}
            empty={<EmptyState title="No signing certificates" />}
          />
        </Container>
      </>
    );
  }

  return (
    <Page>
      <Header variant="h1" info>{name}</Header>
      <Container header={<Header>Summary</Header>}>
        <KeyValue
          items={[
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{user.Arn}</span> },
            { label: "Created", value: formatDate(user.CreateDate) },
            { label: "User ID", value: <span className="font-mono text-[13px]">{user.UserId}</span> },
            { label: "Path", value: user.Path ?? "/" },
            { label: "Last console sign-in", value: user.PasswordLastUsed ? formatDate(user.PasswordLastUsed) : "Never" },
            { label: "Permissions boundary", value: user.PermissionsBoundary?.PermissionsBoundaryArn?.split("/").pop() ?? "Not set" },
          ]}
        />
      </Container>
      <Tabs base={base} active={tab} tabs={TABS} />
      {tabError ? <ErrorAlert message={tabError} /> : body}
    </Page>
  );
}
