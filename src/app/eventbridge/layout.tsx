import { ServiceShell } from "@/components/client/service-shell";

export default function EventBridgeLayout({ children }: LayoutProps<"/eventbridge">) {
  return (
    <ServiceShell
      serviceId="eventbridge"
      title="Amazon EventBridge"
      homeHref="/eventbridge/rules"
      crumbLabels={{ rules: "Rules", create: "Create rule", buses: "Event buses", send: "Send events", archives: "Archives", destinations: "API destinations" }}
      nav={[
        { type: "section", text: "Buses", items: [{ text: "Event buses", href: "/eventbridge/buses" }, { text: "Rules", href: "/eventbridge/rules" }, { text: "Send events", href: "/eventbridge/send" }, { text: "Archives and replays", href: "/eventbridge/archives" }] },
        { type: "section", text: "Integration", items: [{ text: "API destinations", href: "/eventbridge/destinations" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
