import { ServiceShell } from "@/components/client/service-shell";

export default function KmsLayout({ children }: LayoutProps<"/kms">) {
  return (
    <ServiceShell
      serviceId="kms"
      title="Key Management Service (KMS)"
      homeHref="/kms/keys"
      crumbLabels={{ keys: "Customer managed keys", create: "Create key" }}
      nav={[
        { type: "link", text: "AWS managed keys", href: "/kms/keys?scope=aws" },
        { type: "link", text: "Customer managed keys", href: "/kms/keys" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
