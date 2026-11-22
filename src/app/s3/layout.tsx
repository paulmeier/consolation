import { ServiceShell } from "@/components/client/service-shell";

export default function S3Layout({ children }: LayoutProps<"/s3">) {
  return (
    <ServiceShell
      serviceId="s3"
      title="Amazon S3"
      homeHref="/s3/buckets"
      crumbLabels={{ buckets: "Buckets", create: "Create bucket", object: "Object", "access-points": "Access Points" }}
      nav={[
        { type: "section", text: "Buckets", items: [{ text: "General purpose buckets", href: "/s3/buckets" }] },
        { type: "section", text: "Access management and security", items: [{ text: "Access Points", href: "/s3/access-points" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
