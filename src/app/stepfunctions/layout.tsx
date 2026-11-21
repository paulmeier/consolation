import { ServiceShell } from "@/components/client/service-shell";

export default function SfnLayout({ children }: LayoutProps<"/stepfunctions">) {
  return (
    <ServiceShell
      serviceId="stepfunctions"
      title="Step Functions"
      homeHref="/stepfunctions/state-machines"
      crumbLabels={{ "state-machines": "State machines", create: "Create state machine", executions: "Executions", activities: "Activities" }}
      nav={[
        { type: "link", text: "State machines", href: "/stepfunctions/state-machines" },
        { type: "link", text: "Activities", href: "/stepfunctions/activities" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
