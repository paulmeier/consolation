import { DescribeParametersCommand, GetParameterCommand, GetParameterHistoryCommand, ListTagsForResourceCommand, type ParameterHistory } from "@aws-sdk/client-ssm";
import { aws, errorMessage } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { Tabs } from "@/components/tabs";
import { TagsPanel } from "@/components/tags";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Badge, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, LinkButton, buttonClass } from "@/components/ui";
import { deleteParameters, labelVersion, tagParameter, unlabelVersion, untagParameter } from "../../actions";
import { ParameterForm } from "../../parameter-form";
import { ShowDecrypted } from "../../show-decrypted";

export default async function ParameterPage({ searchParams }: PageProps<"/ssm/parameters/view">) {
  const sp = await searchParams;
  const name = String(sp.name ?? "");
  const tab = String(sp.tab ?? "overview");
  const { ssm } = await aws();
  let data;
  try {
    data = await Promise.all([
      ssm.send(new GetParameterCommand({ Name: name })),
      ssm.send(new DescribeParametersCommand({ ParameterFilters: [{ Key: "Name", Option: "Equals", Values: [name] }] })),
      ssm.send(new GetParameterHistoryCommand({ Name: name, MaxResults: 50 })).catch(() => ({ Parameters: [] as ParameterHistory[] })),
      ssm.send(new ListTagsForResourceCommand({ ResourceType: "Parameter", ResourceId: name })).catch(() => ({ TagList: [] })),
    ]);
  } catch (e) {
    return (
      <Page>
        <Header variant="h1">{name}</Header>
        <ErrorAlert message={errorMessage(e)} />
      </Page>
    );
  }
  const [got, desc, history, tags] = data;
  const p = got.Parameter!;
  const meta = desc.Parameters?.[0];
  const base = `/ssm/parameters/view?name=${encodeURIComponent(name)}`;
  const secure = p.Type === "SecureString";
  return (
    <Page>
      <Header
        variant="h1"
        actions={
          <>
            <ConfirmAction values={[name]} action={deleteParameters} extra={{ from: "detail" }} label="Delete" title="Delete parameter" noun="parameter" confirmWord="delete" />
            <LinkButton href={`${base}&tab=edit`} variant="primary">Edit</LinkButton>
          </>
        }
      >
        {name}
      </Header>
      <Tabs
        base={base}
        active={tab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "history", label: "History" },
          { id: "tags", label: "Tags" },
          { id: "edit", label: "Edit" },
        ]}
      />
      {tab === "overview" && (
        <>
          <Container header={<Header>Parameter details</Header>}>
            <KeyValue
              items={[
                { label: "Name", value: p.Name },
                { label: "Description", value: meta?.Description || "-" },
                { label: "Tier", value: meta?.Tier ?? "Standard" },
                { label: "Type", value: p.Type },
                { label: "Data type", value: p.DataType ?? "text" },
                { label: "Version", value: p.Version },
                { label: "ARN", value: <span className="font-mono text-[13px] break-all">{p.ARN}</span> },
                { label: "Last modified date", value: formatDate(p.LastModifiedDate) },
                { label: "Last modified user", value: meta?.LastModifiedUser ?? "-" },
                ...(secure ? [{ label: "KMS key ID", value: meta?.KeyId ?? "alias/aws/ssm" }] : []),
              ]}
            />
          </Container>
          <Container header={<Header>Value</Header>}>
            {secure ? <ShowDecrypted name={name} /> : <pre className="max-h-80 overflow-auto rounded-lg bg-code p-3 font-mono text-[13px] whitespace-pre-wrap break-all">{p.Value}</pre>}
          </Container>
        </>
      )}
      {tab === "history" && (
        <Container noPadding header={<Header counter={history.Parameters?.length ?? 0} description="Each update creates a new version. Attach labels to refer to a version by name (name:label).">History</Header>}>
          <Table
            rows={[...(history.Parameters ?? [])].reverse()}
            rowKey={(h) => String(h.Version)}
            columns={[
              { header: "Version", cell: (h) => h.Version, sortValue: (h) => h.Version ?? 0 },
              { header: "Value", cell: (h) => (h.Type === "SecureString" ? <span className="text-muted">(SecureString)</span> : <span className="font-mono text-[13px] break-all">{h.Value}</span>) },
              { header: "Labels", sortable: false, cell: (h) => (
                <span className="flex flex-wrap items-center gap-1">
                  {(h.Labels ?? []).map((l) => (
                    <form key={l} action={unlabelVersion} className="inline-flex items-center">
                      <input type="hidden" name="name" value={name} />
                      <input type="hidden" name="version" value={h.Version} />
                      <input type="hidden" name="label" value={l} />
                      <Badge>{l} <button aria-label={`Remove label ${l}`} className="ml-1 text-muted hover:text-danger">×</button></Badge>
                    </form>
                  ))}
                  <ModalButton label="Attach labels" title={`Attach labels to version ${h.Version}`}>
                    <form action={labelVersion} className="space-y-4">
                      <input type="hidden" name="name" value={name} />
                      <input type="hidden" name="version" value={h.Version} />
                      <FormField label="Labels" constraint="Comma separated. Labels are case-sensitive, up to 100 characters, and can't start with a number, aws or ssm.">
                        <Input name="labels" required autoFocus />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Attach labels</button></div>
                    </form>
                  </ModalButton>
                </span>
              ) },
              { header: "Last modified date", cell: (h) => formatDate(h.LastModifiedDate) },
              { header: "Modified by", cell: (h) => h.LastModifiedUser ?? "-" },
            ]}
            empty={<EmptyState title="No history" />}
          />
        </Container>
      )}
      {tab === "tags" && <TagsPanel tags={tags.TagList ?? []} addAction={tagParameter} removeAction={untagParameter} hidden={{ name }} />}
      {tab === "edit" && <ParameterForm existing={p} meta={meta} cancelHref={base} />}
    </Page>
  );
}
