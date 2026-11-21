import { ServiceShell } from "@/components/client/service-shell";

export default function RdsLayout({ children }: LayoutProps<"/rds">) {
  return (
    <ServiceShell
      serviceId="rds"
      title="Aurora and RDS"
      homeHref="/rds/databases"
      crumbLabels={{ databases: "Databases", create: "Create database", snapshots: "Snapshots", groups: "Subnet and parameter groups" }}
      nav={[
        { type: "link", text: "Databases", href: "/rds/databases" },
        { type: "link", text: "Snapshots", href: "/rds/snapshots" },
        { type: "link", text: "Subnet and parameter groups", href: "/rds/groups" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
