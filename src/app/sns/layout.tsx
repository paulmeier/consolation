import { ServiceShell } from "@/components/client/service-shell";

export default function SnsLayout({ children }: LayoutProps<"/sns">) {
  return (
    <ServiceShell
      serviceId="sns"
      title="Amazon SNS"
      homeHref="/sns/topics"
      crumbLabels={{ topics: "Topics", subscriptions: "Subscriptions", mobile: null, push: "Push notifications", "text-messaging": "Text messaging (SMS)" }}
      nav={[
        { type: "link", text: "Topics", href: "/sns/topics" },
        { type: "link", text: "Subscriptions", href: "/sns/subscriptions" },
        {
          type: "section",
          text: "Mobile",
          items: [
            { text: "Push notifications", href: "/sns/mobile/push" },
            { text: "Text messaging (SMS)", href: "/sns/mobile/text-messaging" },
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
