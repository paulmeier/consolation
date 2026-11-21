import { notFound } from "next/navigation";
import { serviceById } from "@/lib/services";
import { ServiceIcon } from "@/components/service-icon";
import { Container, Header, LinkButton } from "@/components/ui";

export default async function Placeholder({ params }: PageProps<"/service/[id]">) {
  const { id } = await params;
  const s = serviceById(id);
  if (!s) notFound();
  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 md:px-10">
      <Container header={<Header variant="h1">{s.name}</Header>}>
        <div className="flex items-start gap-4">
          <ServiceIcon service={s} size={48} />
          <div className="space-y-3">
            <p>{s.description}.</p>
            <p className="text-muted">
              Consolation does not have pages for {s.shortName} yet. The emulator may still serve its API: try it from your shell with{" "}
              <code className="font-mono">source ~/.aws/emulator/9297.env</code> and the AWS CLI.
            </p>
            <LinkButton href="/services">Browse all services</LinkButton>
          </div>
        </div>
      </Container>
    </main>
  );
}
