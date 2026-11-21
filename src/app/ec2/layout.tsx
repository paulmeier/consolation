import { ServiceShell } from "@/components/client/service-shell";

export default function Ec2Layout({ children }: LayoutProps<"/ec2">) {
  return (
    <ServiceShell
      serviceId="ec2"
      title="EC2"
      homeHref="/ec2/instances"
      crumbLabels={{ instances: "Instances", launch: "Launch an instance", "security-groups": "Security Groups", "key-pairs": "Key pairs" }}
      nav={[
        { type: "section", text: "Instances", items: [{ text: "Instances", href: "/ec2/instances" }] },
        {
          type: "section",
          text: "Network & Security",
          items: [
            { text: "Security Groups", href: "/ec2/security-groups" },
            { text: "Key Pairs", href: "/ec2/key-pairs" },
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
