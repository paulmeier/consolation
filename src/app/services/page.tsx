import Link from "next/link";
import { CATEGORIES, SERVICES } from "@/lib/services";
import { ServiceIcon } from "@/components/service-icon";
import { Container, Header } from "@/components/ui";

export const metadata = { title: "All services" };

export default function Services() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-10">
      <div className="flex flex-col gap-6">
        <Header variant="h1" description="Services with full pages talk to the local emulator; the rest are placeholders.">
          All services
        </Header>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <Container key={cat} header={<Header>{cat}</Header>}>
              <ul>
                {SERVICES.filter((s) => s.category === cat).map((s) => (
                  <li key={s.id} className="border-b border-line-soft py-2.5 last:border-0">
                    <Link href={s.href} className="flex items-start gap-3">
                      <ServiceIcon service={s} size={28} />
                      <span>
                        <span className="underline-link font-bold">{s.shortName}</span>
                        <span className="block text-sm text-muted">{s.description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Container>
          ))}
        </div>
      </div>
    </main>
  );
}
