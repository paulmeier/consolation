import { ServiceShell } from "@/components/client/service-shell";

export default function ApigwLayout({ children }: LayoutProps<"/apigateway">) {
  return (
    <ServiceShell
      serviceId="apigateway"
      title="API Gateway"
      homeHref="/apigateway/apis"
      crumbLabels={{ apis: "APIs", rest: null, v2: null, "api-keys": "API keys and usage plans" }}
      nav={[
        { type: "link", text: "APIs", href: "/apigateway/apis" },
        { type: "link", text: "API keys and usage plans", href: "/apigateway/api-keys" },
        { type: "divider" },
        { type: "link", text: "Emulator settings", href: "/settings" },
      ]}
    >
      {children}
    </ServiceShell>
  );
}
