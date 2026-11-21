import { ServiceShell } from "@/components/client/service-shell";

export default function VpcLayout({ children }: LayoutProps<"/vpc">) {
  return (
    <ServiceShell
      serviceId="vpc"
      title="VPC dashboard"
      homeHref="/vpc/vpcs"
      crumbLabels={{ vpcs: "Your VPCs", subnets: "Subnets", "route-tables": "Route tables", "internet-gateways": "Internet gateways", "nat-gateways": "NAT gateways", "elastic-ips": "Elastic IP addresses", endpoints: "Endpoints", "network-acls": "Network ACLs", peering: "Peering connections" }}
      nav={[
        {
          type: "section",
          text: "Virtual private cloud",
          items: [
            { text: "Your VPCs", href: "/vpc/vpcs" },
            { text: "Subnets", href: "/vpc/subnets" },
            { text: "Route tables", href: "/vpc/route-tables" },
            { text: "Internet gateways", href: "/vpc/internet-gateways" },
            { text: "Elastic IPs", href: "/vpc/elastic-ips" },
            { text: "NAT gateways", href: "/vpc/nat-gateways" },
            { text: "Peering connections", href: "/vpc/peering" },
            { text: "Endpoints", href: "/vpc/endpoints" },
          ],
        },
        { type: "section", text: "Security", items: [{ text: "Network ACLs", href: "/vpc/network-acls" }, { text: "Security groups", href: "/ec2/security-groups" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
