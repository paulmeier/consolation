import { redirect } from "next/navigation";

/** Breadcrumb target for /eventbridge/rules/<bus>: the rules list filtered to that bus. */
export default async function BusRules({ params }: PageProps<"/eventbridge/rules/[bus]">) {
  redirect(`/eventbridge/rules?bus=${encodeURIComponent(decodeURIComponent((await params).bus))}`);
}
