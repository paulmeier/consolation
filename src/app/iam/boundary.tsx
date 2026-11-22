import type { Policy } from "@aws-sdk/client-iam";
import { ModalButton } from "@/components/client/modal";
import { Container, FormField, Header, Input, KeyValue, buttonClass } from "@/components/ui";
import { setPermissionsBoundary } from "./actions";
import { PolicyDatalist } from "./attached-policies";

/** Permissions boundary: the maximum permissions an identity-based policy can grant. */
export function PermissionsBoundary({ kind, principal, arn, options }: { kind: "user" | "role"; principal: string; arn?: string; options: Policy[] }) {
  const id = `${kind}-boundary-options`;
  return (
    <Container
      header={
        <Header
          description="Sets the maximum permissions that identity-based policies can grant. The emulator stores it but does not enforce it."
          actions={
            <>
              {arn && (
                <form action={setPermissionsBoundary}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="principal" value={principal} />
                  <input type="hidden" name="boundary" value="" />
                  <button className={buttonClass("normal")}>Remove boundary</button>
                </form>
              )}
              <ModalButton label={arn ? "Change boundary" : "Set boundary"} title="Set permissions boundary">
                <form action={setPermissionsBoundary} className="space-y-4">
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="principal" value={principal} />
                  <FormField label="Managed policy">
                    <Input name="boundary" required list={id} defaultValue={arn ?? ""} placeholder="arn:aws:iam::aws:policy/PowerUserAccess" />
                  </FormField>
                  <PolicyDatalist id={id} options={options} />
                  <div className="flex justify-end"><button className={buttonClass("primary")}>Set boundary</button></div>
                </form>
              </ModalButton>
            </>
          }
        >
          Permissions boundary
        </Header>
      }
    >
      <KeyValue columns={1} items={[{ label: "Boundary", value: arn ? <span className="font-mono text-[13px] break-all">{arn}</span> : "Not set" }]} />
    </Container>
  );
}
