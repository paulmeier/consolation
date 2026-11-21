import { ServiceShell } from "@/components/client/service-shell";

export default function S3Layout({ children }: LayoutProps<"/s3">) {
  return (
    <ServiceShell
      serviceId="s3"
      title="Amazon S3"
      homeHref="/s3/buckets"
      crumbLabels={{ buckets: "Buckets", create: "Create bucket", object: "Object" }}
      nav={[
        { type: "section", text: "Buckets", items: [{ text: "General purpose buckets", href: "/s3/buckets" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
