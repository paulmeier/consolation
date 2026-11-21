import { ServiceShell } from "@/components/client/service-shell";

export default function KinesisLayout({ children }: LayoutProps<"/kinesis">) {
  return (
    <ServiceShell
      serviceId="kinesis"
      title="Amazon Kinesis"
      homeHref="/kinesis/streams"
      crumbLabels={{ streams: "Data streams" }}
      nav={[{ type: "link", text: "Data streams", href: "/kinesis/streams" }, { type: "divider" }, { type: "link", text: "Emulator settings", href: "/settings" }]}
    >
      {children}
    </ServiceShell>
  );
}
