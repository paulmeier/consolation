import { ServiceShell } from "@/components/client/service-shell";

export default function CwLayout({ children }: LayoutProps<"/cloudwatch">) {
  return (
    <ServiceShell
      serviceId="cloudwatch"
      title="CloudWatch"
      homeHref="/cloudwatch/log-groups"
      crumbLabels={{ "log-groups": "Log groups", metrics: "All metrics", alarms: "All alarms", dashboards: "Dashboards" }}
      nav={[
        { type: "link", text: "Dashboards", href: "/cloudwatch/dashboards" },
        { type: "section", text: "Alarms", items: [{ text: "All alarms", href: "/cloudwatch/alarms" }] },
        { type: "section", text: "Logs", items: [{ text: "Log groups", href: "/cloudwatch/log-groups" }] },
        { type: "section", text: "Metrics", items: [{ text: "All metrics", href: "/cloudwatch/metrics" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
