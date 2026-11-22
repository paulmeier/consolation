import {
  GetAccountPasswordPolicyCommand,
  GetAccountSummaryCommand,
  GetCredentialReportCommand,
  ListAccountAliasesCommand,
  type PasswordPolicy,
} from "@aws-sdk/client-iam";
import { aws, errorMessage, EMULATOR_ACCOUNT } from "@/lib/emulator";
import { formatDate } from "@/lib/format";
import { Page } from "@/components/page";
import { ModalButton } from "@/components/client/modal";
import { Container, ErrorAlert, FormField, Header, Input, KeyValue, Select, buttonClass } from "@/components/ui";
import { deletePasswordPolicy, generateCredentialReport, setAccountAlias, setStsPreferences, updatePasswordPolicy } from "../actions";

export const metadata = { title: "Account settings | IAM" };

function Check({ name, label, checked }: { name: string; label: string; checked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="accent-accent" /> {label}
    </label>
  );
}

export default async function AccountSettingsPage() {
  const { iam } = await aws();
  let policy: PasswordPolicy | null = null;
  let alias = "";
  let summary: Record<string, number> = {};
  let report: { csv: string; generated?: Date } | null = null;
  let error: string | null = null;
  try {
    [alias, summary] = await Promise.all([
      iam.send(new ListAccountAliasesCommand({})).then((r) => r.AccountAliases?.[0] ?? ""),
      iam.send(new GetAccountSummaryCommand({})).then((r) => r.SummaryMap ?? {}),
    ]);
    policy = await iam.send(new GetAccountPasswordPolicyCommand({})).then((r) => r.PasswordPolicy ?? null).catch(() => null);
    report = await iam
      .send(new GetCredentialReportCommand({}))
      .then((r) => ({ csv: r.Content ? Buffer.from(r.Content).toString("utf8") : "", generated: r.GeneratedTime }))
      .catch(() => null);
  } catch (e) {
    error = errorMessage(e);
  }
  const rows = report?.csv.trim().split("\n").map((l) => l.split(",")) ?? [];
  return (
    <Page>
      <Header variant="h1" info>Account settings</Header>
      {error && <ErrorAlert message={error} />}
      <Container
        header={
          <Header
            description="Requirements for IAM user console passwords."
            actions={
              <>
                {policy && (
                  <form action={deletePasswordPolicy}>
                    <button className={buttonClass("normal")}>Reset to IAM default</button>
                  </form>
                )}
                <ModalButton label="Edit" title="Edit password policy">
                  <form action={updatePasswordPolicy} className="space-y-3">
                    <FormField label="Minimum password length" constraint="6 to 128 characters.">
                      <Input name="minLength" type="number" min={6} max={128} defaultValue={String(policy?.MinimumPasswordLength ?? 8)} />
                    </FormField>
                    <Check name="upper" label="Require at least one uppercase letter (A-Z)" checked={policy?.RequireUppercaseCharacters} />
                    <Check name="lower" label="Require at least one lowercase letter (a-z)" checked={policy?.RequireLowercaseCharacters} />
                    <Check name="numbers" label="Require at least one number" checked={policy?.RequireNumbers} />
                    <Check name="symbols" label="Require at least one non-alphanumeric character" checked={policy?.RequireSymbols} />
                    <Check name="allowChange" label="Allow users to change their own password" checked={policy?.AllowUsersToChangePassword ?? true} />
                    <div className="flex items-center gap-3">
                      <Check name="expire" label="Turn on password expiration after (days)" checked={!!policy?.MaxPasswordAge} />
                      <Input name="maxAge" type="number" min={1} max={1095} defaultValue={String(policy?.MaxPasswordAge ?? 90)} className="w-24" />
                    </div>
                    <Check name="hardExpiry" label="Password expiration requires administrator reset" checked={policy?.HardExpiry} />
                    <div className="flex items-center gap-3">
                      <Check name="reuse" label="Prevent password reuse (remember last)" checked={!!policy?.PasswordReusePrevention} />
                      <Input name="reuseCount" type="number" min={1} max={24} defaultValue={String(policy?.PasswordReusePrevention ?? 5)} className="w-24" />
                    </div>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Password policy
          </Header>
        }
      >
        {policy ? (
          <KeyValue
            items={[
              { label: "Minimum length", value: `${policy.MinimumPasswordLength} characters` },
              { label: "Character requirements", value: [policy.RequireUppercaseCharacters && "uppercase", policy.RequireLowercaseCharacters && "lowercase", policy.RequireNumbers && "number", policy.RequireSymbols && "symbol"].filter(Boolean).join(", ") || "None" },
              { label: "Users can change password", value: policy.AllowUsersToChangePassword ? "Yes" : "No" },
              { label: "Expiration", value: policy.MaxPasswordAge ? `${policy.MaxPasswordAge} days${policy.HardExpiry ? " (administrator reset)" : ""}` : "Never" },
              { label: "Reuse prevention", value: policy.PasswordReusePrevention ? `Last ${policy.PasswordReusePrevention}` : "Off" },
            ]}
          />
        ) : (
          <p className="text-muted">This account uses the IAM default password policy.</p>
        )}
      </Container>
      <Container
        header={
          <Header
            actions={
              <ModalButton label={alias ? "Edit" : "Create"} title="Account alias">
                <form action={setAccountAlias} className="space-y-4">
                  <input type="hidden" name="old" value={alias} />
                  <FormField label="Account alias" description="Leave empty to delete the alias." constraint="3 to 63 lowercase letters, numbers and hyphens.">
                    <Input name="alias" defaultValue={alias} pattern="[a-z0-9](?:[a-z0-9\-]{1,61}[a-z0-9])?" />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            Account alias
          </Header>
        }
      >
        <KeyValue
          items={[
            { label: "Account ID", value: EMULATOR_ACCOUNT },
            { label: "Account alias", value: alias || "-" },
            { label: "Sign-in URL", value: <span className="font-mono text-[13px]">https://{alias || EMULATOR_ACCOUNT}.signin.aws.amazon.com/console</span> },
          ]}
        />
      </Container>
      <Container
        header={
          <Header
            description="Session tokens from the global STS endpoint can be valid in all Regions (v2) or only in Regions enabled by default (v1)."
            actions={
              <ModalButton label="Edit" title="Security Token Service (STS)">
                <form action={setStsPreferences} className="space-y-4">
                  <FormField label="Global endpoint session token version">
                    <Select name="version" defaultValue={summary.GlobalEndpointTokenVersion === 2 ? "v2Token" : "v1Token"}>
                      <option value="v1Token">Valid only in AWS Regions enabled by default</option>
                      <option value="v2Token">Valid in all AWS Regions</option>
                    </Select>
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            Security Token Service (STS)
          </Header>
        }
      >
        <KeyValue items={[{ label: "Global endpoint tokens", value: summary.GlobalEndpointTokenVersion === 2 ? "Valid in all AWS Regions" : "Valid only in Regions enabled by default" }]} />
      </Container>
      <Container
        header={
          <Header
            description="A report of all IAM users and the status of their credentials."
            actions={
              <form action={generateCredentialReport}>
                <button className={buttonClass("normal")}>Generate report</button>
              </form>
            }
          >
            Credential report
          </Header>
        }
      >
        {report?.csv ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">Generated {formatDate(report.generated)}.</p>
            <div className="max-h-96 overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr>{rows[0]?.map((h) => <th key={h} className="border-b border-line px-2 py-1 font-medium whitespace-nowrap text-muted">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(1).map((r, i) => (
                    <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-line-soft px-2 py-1 whitespace-nowrap">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-muted">No report yet. Generate one, then refresh.</p>
        )}
      </Container>
      <Container header={<Header>IAM resources</Header>}>
        <KeyValue
          columns={4}
          items={["Users", "Groups", "Roles", "Policies", "InstanceProfiles", "Providers", "ServerCertificates", "MFADevices"].filter((k) => k in summary).map((k) => ({ label: k.replace(/([a-z])([A-Z])/g, "$1 $2"), value: String(summary[k]) }))}
        />
      </Container>
    </Page>
  );
}
