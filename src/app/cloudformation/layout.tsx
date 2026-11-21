import { ServiceShell } from "@/components/client/service-shell";

export default function CfnLayout({ children }: LayoutProps<"/cloudformation">) {
  return (
    <ServiceShell
      serviceId="cloudformation"
      title="CloudFormation"
      homeHref="/cloudformation/stacks"
      crumbLabels={{ stacks: "Stacks", create: "Create stack", exports: "Exports" }}
      nav={[
        { type: "link", text: "Stacks", href: "/cloudformation/stacks" },
        { type: "link", text: "Exports", href: "/cloudformation/exports" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
