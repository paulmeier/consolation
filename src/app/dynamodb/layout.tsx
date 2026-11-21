import { ServiceShell } from "@/components/client/service-shell";

export default function DynamoLayout({ children }: LayoutProps<"/dynamodb">) {
  return (
    <ServiceShell
      serviceId="dynamodb"
      title="DynamoDB"
      homeHref="/dynamodb/tables"
      crumbLabels={{ tables: "Tables", create: "Create table" }}
      nav={[
        { type: "link", text: "Tables", href: "/dynamodb/tables" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
