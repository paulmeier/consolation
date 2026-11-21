import { ServiceShell } from "@/components/client/service-shell";

export default function CwLayout({ children }: LayoutProps<"/cloudwatch">) {
  return (
    <ServiceShell
      serviceId="cloudwatch"
      title="CloudWatch"
      homeHref="/cloudwatch/log-groups"
      crumbLabels={{ "log-groups": "Log groups" }}
      nav={[
        { type: "section", text: "Logs", items: [{ text: "Log groups", href: "/cloudwatch/log-groups" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
