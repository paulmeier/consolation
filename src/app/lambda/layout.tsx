import { ServiceShell } from "@/components/client/service-shell";

export default function LambdaLayout({ children }: LayoutProps<"/lambda">) {
  return (
    <ServiceShell
      serviceId="lambda"
      title="Lambda"
      homeHref="/lambda/functions"
      crumbLabels={{ functions: "Functions", create: "Create function", layers: "Layers" }}
      nav={[
        { type: "link", text: "Functions", href: "/lambda/functions" },
        { type: "section", text: "Additional resources", items: [{ text: "Layers", href: "/lambda/layers" }] },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
