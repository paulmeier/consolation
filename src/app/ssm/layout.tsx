import { ServiceShell } from "@/components/client/service-shell";

export default function SsmLayout({ children }: LayoutProps<"/ssm">) {
  return (
    <ServiceShell
      serviceId="ssm"
      title="AWS Systems Manager"
      homeHref="/ssm/parameters"
      crumbLabels={{ parameters: "Parameter Store", create: "Create parameter", view: "Parameter" }}
      nav={[
        { type: "section", text: "Application Tools", items: [{ text: "Parameter Store", href: "/ssm/parameters" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
