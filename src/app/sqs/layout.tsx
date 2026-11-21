import { ServiceShell } from "@/components/client/service-shell";

export default function SqsLayout({ children }: LayoutProps<"/sqs">) {
  return (
    <ServiceShell
      serviceId="sqs"
      title="Amazon SQS"
      homeHref="/sqs/queues"
      crumbLabels={{ queues: "Queues" }}
      nav={[{ type: "link", text: "Queues", href: "/sqs/queues" }, { type: "divider" }, { type: "link", text: "Emulator settings", href: "/settings" }]}
    >
      {children}
    </ServiceShell>
  );
}
