import { ServiceShell } from "@/components/client/service-shell";

export default function SecretsLayout({ children }: LayoutProps<"/secretsmanager">) {
  return (
    <ServiceShell
      serviceId="secretsmanager"
      title="AWS Secrets Manager"
      homeHref="/secretsmanager/secrets"
      crumbLabels={{ secrets: "Secrets", create: "Store a new secret" }}
      nav={[{ type: "link", text: "Secrets", href: "/secretsmanager/secrets" }, { type: "divider" }, { type: "link", text: "Emulator settings", href: "/settings" }]}
    >
      {children}
    </ServiceShell>
  );
}
