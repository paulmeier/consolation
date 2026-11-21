import { ServiceShell } from "@/components/client/service-shell";

export default function IamLayout({ children }: LayoutProps<"/iam">) {
  return (
    <ServiceShell
      serviceId="iam"
      title="Identity and Access Management (IAM)"
      homeHref="/iam/users"
      crumbLabels={{ users: "Users", roles: "Roles", policies: "Policies" }}
      nav={[
        {
          type: "section",
          text: "Access management",
          items: [
            { text: "Users", href: "/iam/users" },
            { text: "Roles", href: "/iam/roles" },
            { text: "Policies", href: "/iam/policies" },
          ],
        },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
