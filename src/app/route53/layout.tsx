import { ServiceShell } from "@/components/client/service-shell";

export default function Route53Layout({ children }: LayoutProps<"/route53">) {
  return (
    <ServiceShell
      serviceId="route53"
      title="Route 53"
      homeHref="/route53/hosted-zones"
      crumbLabels={{ "hosted-zones": "Hosted zones", "health-checks": "Health checks" }}
      nav={[
        { type: "link", text: "Hosted zones", href: "/route53/hosted-zones" },
        { type: "link", text: "Health checks", href: "/route53/health-checks" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
