import { ServiceShell } from "@/components/client/service-shell";

export default function Ec2Layout({ children }: LayoutProps<"/ec2">) {
  return (
    <ServiceShell
      serviceId="ec2"
      title="EC2"
      homeHref="/ec2/instances"
      crumbLabels={{
        instances: "Instances",
        launch: "Launch an instance",
        "security-groups": "Security Groups",
        "key-pairs": "Key pairs",
        amis: "AMIs",
        volumes: "Volumes",
        snapshots: "Snapshots",
        "launch-templates": "Launch templates",
        "elastic-ips": "Elastic IP addresses",
        "network-interfaces": "Network interfaces",
        "placement-groups": "Placement groups",
        "spot-requests": "Spot Requests",
        "capacity-reservations": "Capacity Reservations",
        "dedicated-hosts": "Dedicated Hosts",
      }}
      nav={[
        {
          type: "section",
          text: "Instances",
          items: [
            { text: "Instances", href: "/ec2/instances" },
            { text: "Launch Templates", href: "/ec2/launch-templates" },
            { text: "Spot Requests", href: "/ec2/spot-requests" },
            { text: "Dedicated Hosts", href: "/ec2/dedicated-hosts" },
            { text: "Capacity Reservations", href: "/ec2/capacity-reservations" },
          ],
        },
        { type: "section", text: "Images", items: [{ text: "AMIs", href: "/ec2/amis" }] },
        {
          type: "section",
          text: "Elastic Block Store",
          items: [
            { text: "Volumes", href: "/ec2/volumes" },
            { text: "Snapshots", href: "/ec2/snapshots" },
          ],
        },
        {
          type: "section",
          text: "Network & Security",
          items: [
            { text: "Security Groups", href: "/ec2/security-groups" },
            { text: "Elastic IPs", href: "/ec2/elastic-ips" },
            { text: "Placement Groups", href: "/ec2/placement-groups" },
            { text: "Key Pairs", href: "/ec2/key-pairs" },
            { text: "Network Interfaces", href: "/ec2/network-interfaces" },
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
