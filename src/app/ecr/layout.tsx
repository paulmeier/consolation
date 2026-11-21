import { ServiceShell } from "@/components/client/service-shell";

export default function EcrLayout({ children }: LayoutProps<"/ecr">) {
  return (
    <ServiceShell
      serviceId="ecr"
      title="Amazon Elastic Container Registry"
      homeHref="/ecr/repositories"
      crumbLabels={{ repositories: "Private repositories" }}
      nav={[{ type: "section", text: "Private registry", items: [{ text: "Repositories", href: "/ecr/repositories" }] }, { type: "divider" }, { type: "link", text: "Emulator settings", href: "/settings" }]}
    >
      {children}
    </ServiceShell>
  );
}
