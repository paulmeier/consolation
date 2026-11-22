import {
  GetSMSAttributesCommand,
  GetSMSSandboxAccountStatusCommand,
  ListPhoneNumbersOptedOutCommand,
  ListSMSSandboxPhoneNumbersCommand,
  type SMSSandboxPhoneNumber,
} from "@aws-sdk/client-sns";
import { aws, errorMessage } from "@/lib/emulator";
import { Page } from "@/components/page";
import { Table } from "@/components/table";
import { ConfirmAction } from "@/components/client/confirm-action";
import { ModalButton } from "@/components/client/modal";
import { Alert, Container, EmptyState, ErrorAlert, FormField, Header, Input, KeyValue, Select, StatusIndicator, buttonClass } from "@/components/ui";
import { addSandboxNumber, deleteSandboxNumbers, optInNumbers, setSmsPreferences, verifySandboxNumber } from "../../actions";

export const metadata = { title: "Text messaging (SMS) | Amazon SNS" };

export default async function SmsPage() {
  let prefs: Record<string, string> = {};
  let sandbox = true;
  let numbers: SMSSandboxPhoneNumber[] = [];
  let optedOut: string[] = [];
  let error: string | null = null;
  try {
    const { sns } = await aws();
    [prefs, sandbox, numbers, optedOut] = await Promise.all([
      sns.send(new GetSMSAttributesCommand({})).then((r) => r.attributes ?? {}),
      sns.send(new GetSMSSandboxAccountStatusCommand({})).then((r) => r.IsInSandbox ?? true),
      sns.send(new ListSMSSandboxPhoneNumbersCommand({})).then((r) => r.PhoneNumbers ?? []),
      sns.send(new ListPhoneNumbersOptedOutCommand({})).then((r) => r.phoneNumbers ?? []),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  return (
    <Page>
      <Header variant="h1" description="Send SMS messages from Amazon SNS. The emulator records numbers and preferences but sends no texts.">
        Text messaging (SMS)
      </Header>
      {error && <ErrorAlert message={error} />}
      <Container
        header={
          <Header
            actions={
              <ModalButton label="Edit" title="Text messaging preferences">
                <form action={setSmsPreferences} className="space-y-4">
                  <FormField label="Default message type">
                    <Select name="DefaultSMSType" defaultValue={prefs.DefaultSMSType ?? "Promotional"}>
                      <option>Promotional</option>
                      <option>Transactional</option>
                    </Select>
                  </FormField>
                  <FormField label="Account spend limit (USD)">
                    <Input name="MonthlySpendLimit" type="number" min={0} defaultValue={prefs.MonthlySpendLimit ?? "1"} />
                  </FormField>
                  <FormField label={<>Default sender ID <i className="font-normal text-muted">- optional</i></>}>
                    <Input name="DefaultSenderID" maxLength={11} defaultValue={prefs.DefaultSenderID ?? ""} />
                  </FormField>
                  <FormField label={<>Usage report S3 bucket <i className="font-normal text-muted">- optional</i></>}>
                    <Input name="UsageReportS3Bucket" defaultValue={prefs.UsageReportS3Bucket ?? ""} />
                  </FormField>
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Save changes</button></div>
                </form>
              </ModalButton>
            }
          >
            Text messaging preferences
          </Header>
        }
      >
        <KeyValue
          items={[
            { label: "Account status", value: sandbox ? <StatusIndicator type="info">Sandbox</StatusIndicator> : <StatusIndicator type="success">Production</StatusIndicator> },
            { label: "Default message type", value: prefs.DefaultSMSType ?? "Promotional" },
            { label: "Account spend limit", value: `${prefs.MonthlySpendLimit ?? "1"} USD` },
            { label: "Default sender ID", value: prefs.DefaultSenderID || "-" },
            { label: "Usage report bucket", value: prefs.UsageReportS3Bucket || "-" },
          ]}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header
            counter={numbers.length}
            description="In the SMS sandbox you can only send to verified destination numbers."
            actions={
              <>
                <ConfirmAction formId="sandbox-form" action={deleteSandboxNumbers} label="Delete phone number" title="Delete phone numbers" noun="phone number" />
                {numbers.some((n) => n.Status === "Pending") && (
                  <ModalButton label="Verify phone number" title="Verify phone number">
                    <form action={verifySandboxNumber} className="space-y-4">
                      <FormField label="Phone number">
                        <Select name="phone">{numbers.filter((n) => n.Status === "Pending").map((n) => <option key={n.PhoneNumber}>{n.PhoneNumber}</option>)}</Select>
                      </FormField>
                      <FormField label="Verification code">
                        <Input name="otp" required />
                      </FormField>
                      <div className="flex justify-end"><button className={buttonClass("primary")}>Verify phone number</button></div>
                    </form>
                  </ModalButton>
                )}
                <ModalButton label="Add phone number" title="Add sandbox destination phone number" variant="primary">
                  <form action={addSandboxNumber} className="space-y-4">
                    <FormField label="Phone number" constraint="E.164 format, for example +12065550100.">
                      <Input name="phone" required pattern="\+[1-9][0-9]{6,14}" placeholder="+12065550100" />
                    </FormField>
                    <div className="flex justify-end"><button className={buttonClass("primary")}>Add phone number</button></div>
                  </form>
                </ModalButton>
              </>
            }
          >
            Sandbox destination phone numbers
          </Header>
        }
      >
        <form id="sandbox-form" />
        <Table
          formId="sandbox-form"
          selection="multi"
          rows={numbers}
          rowKey={(n) => n.PhoneNumber ?? ""}
          columns={[
            { header: "Phone number", cell: (n) => n.PhoneNumber },
            { header: "Verification status", cell: (n) => (n.Status === "Verified" ? <StatusIndicator type="success">Verified</StatusIndicator> : <StatusIndicator type="pending">{n.Status}</StatusIndicator>) },
          ]}
          empty={<EmptyState title="No phone numbers" description="Add a destination phone number to test SMS in the sandbox." />}
        />
      </Container>
      <Container
        noPadding
        header={
          <Header counter={optedOut.length} description="Numbers that replied STOP. Opt a number back in to send to it again." actions={<button form="optout-form" className={`${buttonClass("normal")} needs-selection`}>Opt in</button>}>
            Opted-out phone numbers
          </Header>
        }
      >
        <form id="optout-form" action={optInNumbers} />
        <Table formId="optout-form" selection="multi" rows={optedOut} rowKey={(n) => n} columns={[{ header: "Phone number", cell: (n) => n }]} empty={<EmptyState title="No opted-out numbers" />} />
      </Container>
      <Alert>Origination numbers, sender IDs and registrations are managed in AWS End User Messaging, which Consolation does not cover yet.</Alert>
    </Page>
  );
}
