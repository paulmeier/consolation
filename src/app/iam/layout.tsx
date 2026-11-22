import { ServiceShell } from "@/components/client/service-shell";

export default function IamLayout({ children }: LayoutProps<"/iam">) {
  return (
    <ServiceShell
      serviceId="iam"
      title="Identity and Access Management (IAM)"
      homeHref="/iam/users"
      crumbLabels={{ users: "Users", roles: "Roles", policies: "Policies", groups: "User groups", "identity-providers": "Identity providers", "account-settings": "Account settings", sts: "STS playground" }}
      nav={[
        {
          type: "section",
          text: "Access management",
          items: [
            { text: "User groups", href: "/iam/groups" },
            { text: "Users", href: "/iam/users" },
            { text: "Roles", href: "/iam/roles" },
            { text: "Policies", href: "/iam/policies" },
            { text: "Identity providers", href: "/iam/identity-providers" },
            { text: "Account settings", href: "/iam/account-settings" },
          ],
        },
        { type: "section", text: "Tools", items: [{ text: "STS playground", href: "/iam/sts" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
