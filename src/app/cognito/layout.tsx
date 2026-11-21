import { ServiceShell } from "@/components/client/service-shell";

export default function CognitoLayout({ children }: LayoutProps<"/cognito">) {
  return (
    <ServiceShell
      serviceId="cognito"
      title="Amazon Cognito"
      homeHref="/cognito/user-pools"
      crumbLabels={{ "user-pools": "User pools", "identity-pools": "Identity pools" }}
      nav={[
        { type: "link", text: "User pools", href: "/cognito/user-pools" },
        { type: "link", text: "Identity pools", href: "/cognito/identity-pools" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
