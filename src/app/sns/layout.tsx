import { ServiceShell } from "@/components/client/service-shell";

export default function SnsLayout({ children }: LayoutProps<"/sns">) {
  return (
    <ServiceShell
      serviceId="sns"
      title="Amazon SNS"
      homeHref="/sns/topics"
      crumbLabels={{ topics: "Topics" }}
      nav={[{ type: "link", text: "Topics", href: "/sns/topics" }, { type: "divider" }, { type: "link", text: "Emulator settings", href: "/settings" }]}
    >
      {children}
    </ServiceShell>
  );
}
