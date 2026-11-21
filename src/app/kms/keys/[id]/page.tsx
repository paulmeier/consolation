import { DescribeKeyCommand, GetKeyPolicyCommand, GetKeyRotationStatusCommand, ListAliasesCommand, ListResourceTagsCommand } from "@aws-sdk/client-kms";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TagsPanel } from "@/components/tags";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Alert, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, StatusIndicator, Textarea, buttonClass } from "@/components/ui";
import { addAlias, cancelDeletion, deleteAliases, saveDescription, saveKeyPolicy, scheduleDeletion, setKeyEnabled, setRotation, tagKey, untagKey } from "../../actions";
import { CryptoPlayground } from "../../playground";
import { keyState } from "../../shared";

export default async function KeyPage({ params, searchParams }: PageProps<"/kms/keys/[id]">) {
  const id = decodeURIComponent((await params).id);
  const tab = String((await searchParams).tab ?? "config");
  const { kms } = await aws();
  let data;
  try {
    data = await Promise.all([
      kms.send(new DescribeKeyCommand({ KeyId: id })),
      kms.send(new GetKeyPolicyCommand({ KeyId: id, PolicyName: "default" })).catch(() => ({ Policy: undefined })),
      kms.send(new GetKeyRotationStatusCommand({ KeyId: id })).catch(() => null),
      kms.send(new ListAliasesCommand({ KeyId: id })).catch(() => ({ Aliases: [] })),
      kms.send(new ListResourceTagsCommand({ KeyId: id })).catch(() => ({ Tags: [] })),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{id}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [desc, policy, rotation, aliases, tags] = data;
  const k = desc.KeyMetadata!;
  const awsManaged = k.KeyManager === "AWS";
  const hidden = <input type="hidden" name="id" value={k.KeyId} />;
  const base = `/kms/keys/${k.KeyId}`;
  const symmetric = k.KeySpec === "SYMMETRIC_DEFAULT";
  let prettyPolicy = policy.Policy ?? "";
  try {
    prettyPolicy = JSON.stringify(JSON.parse(prettyPolicy), null, 2);
  } catch {}

  return (
    <Page>
      <Header
        variant="h1"
        info
        actions={
          !awsManaged && (
            <>
              {k.KeyState === "PendingDeletion" ? (
                <form action={cancelDeletion}>{hidden}<button className={buttonClass("normal")}>Cancel key deletion</button></form>
              ) : (
                <>
                  <form action={setKeyEnabled}>
                    {hidden}
                    <input type="hidden" name="enable" value={k.Enabled ? "false" : "true"} />
                    <button className={buttonClass("normal")}>{k.Enabled ? "Disable" : "Enable"}</button>
                  </form>
                  <ConfirmAction
                    values={[k.KeyId!]}
                    action={scheduleDeletion}
                    label="Schedule key deletion"
                    title="Schedule key deletion"
                    noun="key"
                    confirmWord="confirm"
                    confirmLabel="Schedule deletion"
                    fields={<div className="space-y-1"><label className="block text-sm font-bold">Waiting period (in days)</label><Input name="window" type="number" min={7} max={30} defaultValue={30} /></div>}
                  />
                </>
              )}
            </>
          )
        }
      >
        {aliases.Aliases?.[0]?.AliasName ?? k.KeyId}
      </Header>
      {k.KeyState === "PendingDeletion" && <Alert type="warning">This key is scheduled for deletion on {formatDate(k.DeletionDate)}.</Alert>}
      <Container
        header={
          <Header
            actions={
              !awsManaged && (
                <ModalButton label="Edit description" title="Edit description">
                  <form action={saveDescription} className="space-y-4">
                    {hidden}
                    <FormField label="Description"><Input name="description" defaultValue={k.Description ?? ""} /></FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save</button></div>
                  </form>
                </ModalButton>
              )
            }
          >
            General configuration
          </Header>
        }
      >
        <KeyValue
          items={[
            { label: "Alias", value: aliases.Aliases?.map((a) => a.AliasName).join(", ") || "-" },
            { label: "Status", value: keyState(k.KeyState) },
            { label: "Creation date", value: formatDate(k.CreationDate) },
            { label: "ARN", value: <span className="font-mono text-[13px] break-all">{k.Arn}</span> },
            { label: "Description", value: k.Description || "-" },
            { label: "Regionality", value: k.MultiRegion ? "Multi-Region" : "Single Region" },
          ]}
        />
      </Container>
      <Tabs
        base={base}
        active={tab}
        tabs={[
          { id: "config", label: "Cryptographic configuration" },
          { id: "policy", label: "Key policy" },
          { id: "rotation", label: "Key rotation" },
          { id: "aliases", label: "Aliases" },
          { id: "tags", label: "Tags" },
          { id: "test", label: "Test" },
        ]}
      />
      {tab === "config" && (
        <Container header={<Header>Cryptographic configuration</Header>}>
          <KeyValue
            items={[
              { label: "Key type", value: symmetric ? "Symmetric" : k.KeySpec?.startsWith("HMAC") ? "HMAC" : "Asymmetric" },
              { label: "Origin", value: k.Origin },
              { label: "Key spec", value: k.KeySpec },
              { label: "Key usage", value: k.KeyUsage },
              { label: "Encryption algorithms", value: k.EncryptionAlgorithms?.join(", ") || "-" },
              { label: "Signing algorithms", value: k.SigningAlgorithms?.join(", ") || "-" },
              { label: "MAC algorithms", value: k.MacAlgorithms?.join(", ") || "-" },
            ]}
          />
        </Container>
      )}
      {tab === "policy" && (
        <Container header={<Header description="The emulator stores the key policy but does not enforce it.">Key policy</Header>}>
          <form action={saveKeyPolicy} className="space-y-3">
            {hidden}
            <Textarea name="policy" rows={18} defaultValue={prettyPolicy} spellCheck={false} readOnly={awsManaged} />
            {!awsManaged && <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>}
          </form>
        </Container>
      )}
      {tab === "rotation" && (
        <Container header={<Header description="Automatic rotation is available for symmetric encryption keys only.">Key rotation</Header>}>
          {symmetric && !awsManaged ? (
            <form action={setRotation} className="space-y-4">
              {hidden}
              <KeyValue items={[
                { label: "Automatic key rotation", value: rotation?.KeyRotationEnabled ? <StatusIndicator type="success">Enabled</StatusIndicator> : <StatusIndicator type="stopped">Disabled</StatusIndicator> },
                { label: "Rotation period", value: rotation?.RotationPeriodInDays ? `${rotation.RotationPeriodInDays} days` : "-" },
                { label: "Next rotation date", value: formatDate(rotation?.NextRotationDate) },
              ]} />
              <input type="hidden" name="enable" value={rotation?.KeyRotationEnabled ? "false" : "true"} />
              {!rotation?.KeyRotationEnabled && <FormField label="Rotation period (in days)" constraint="Between 90 and 2560 days."><Input name="days" type="number" min={90} max={2560} defaultValue={365} /></FormField>}
              <div className="flex justify-end"><button className={buttonClass("primary")}>{rotation?.KeyRotationEnabled ? "Disable rotation" : "Enable rotation"}</button></div>
            </form>
          ) : (
            <p className="text-muted">{awsManaged ? "AWS rotates AWS managed keys automatically." : "Automatic key rotation is not supported for this key spec."}</p>
          )}
        </Container>
      )}
      {tab === "aliases" && (
        <Container
          noPadding
          header={
            <Header
              counter={aliases.Aliases?.length ?? 0}
              actions={!awsManaged && (
                <>
                  <ConfirmAction formId="aliases-form" action={deleteAliases} extra={{ id: k.KeyId! }} label="Delete" title="Delete alias" noun="alias" confirmWord="delete" />
                  <ModalButton label="Create alias" title="Create alias" variant="primary">
                    <form action={addAlias} className="space-y-4">
                      {hidden}
                      <FormField label="Alias name"><Input name="alias" required placeholder="alias/my-key" autoFocus /></FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Create alias</button></div>
                    </form>
                  </ModalButton>
                </>
              )}
            >
              Aliases
            </Header>
          }
        >
          <form id="aliases-form" />
          <Table
            formId="aliases-form"
            selection={awsManaged ? undefined : "multi"}
            rows={aliases.Aliases ?? []}
            rowKey={(a) => a.AliasName!}
            columns={[
              { header: "Alias name", cell: (a) => a.AliasName },
              { header: "Alias ARN", cell: (a) => <span className="font-mono text-[13px]">{a.AliasArn}</span> },
              { header: "Created", cell: (a) => formatDate(a.CreationDate) },
            ]}
            empty={<EmptyState title="No aliases" />}
          />
        </Container>
      )}
      {tab === "tags" && <TagsPanel tags={(tags.Tags ?? []).map((t) => ({ Key: t.TagKey, Value: t.TagValue }))} addAction={tagKey} removeAction={untagKey} hidden={{ id: k.KeyId! }} />}
      {tab === "test" && (
        <Container header={<Header description="Run cryptographic operations with this key in the emulator.">Cryptographic operations</Header>}>
          {k.Enabled ? (
            <CryptoPlayground keyId={k.KeyId!} usage={k.KeyUsage ?? "ENCRYPT_DECRYPT"} signingAlgorithms={k.SigningAlgorithms ?? []} macAlgorithms={k.MacAlgorithms ?? []} />
          ) : (
            <p className="text-muted">Enable the key to use it.</p>
          )}
        </Container>
      )}
    </Page>
  );
}
