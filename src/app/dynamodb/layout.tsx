import { ServiceShell } from "@/components/client/service-shell";

export default function DynamoLayout({ children }: LayoutProps<"/dynamodb">) {
  return (
    <ServiceShell
      serviceId="dynamodb"
      title="DynamoDB"
      homeHref="/dynamodb/tables"
      crumbLabels={{ tables: "Tables", create: "Create table", imports: "Imports from S3", exports: "Exports to S3" }}
      nav={[
        { type: "link", text: "Tables", href: "/dynamodb/tables" },
        { type: "link", text: "Imports from S3", href: "/dynamodb/imports" },
        { type: "link", text: "Exports to S3", href: "/dynamodb/exports" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
