import { ServiceShell } from "@/components/client/service-shell";

export default function EcsLayout({ children }: LayoutProps<"/ecs">) {
  return (
    <ServiceShell
      serviceId="ecs"
      title="Amazon Elastic Container Service"
      homeHref="/ecs/clusters"
      crumbLabels={{ clusters: "Clusters", "task-definitions": "Task definitions", create: "Create new task definition" }}
      nav={[
        { type: "link", text: "Clusters", href: "/ecs/clusters" },
        { type: "link", text: "Task definitions", href: "/ecs/task-definitions" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
