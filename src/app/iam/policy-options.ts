import { ListPoliciesCommand, type Policy } from "@aws-sdk/client-iam";
import type { Clients } from "@/lib/emulator";

/** Every managed policy (customer and AWS) for pickers. */
export async function allPolicies(iam: Clients["iam"]): Promise<Policy[]> {
  const out: Policy[] = [];
  let Marker: string | undefined;
  do {
    const r = await iam.send(new ListPoliciesCommand({ Scope: "All", MaxItems: 1000, Marker }));
    out.push(...(r.Policies ?? []));
    Marker = r.IsTruncated ? r.Marker : undefined;
  } while (Marker);
  return out.sort((a, b) => (a.PolicyName ?? "").localeCompare(b.PolicyName ?? ""));
}

export function decodeDoc(doc?: string) {
  if (!doc) return "";
  let text = doc;
  try {
    text = decodeURIComponent(doc);
  } catch {}
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export const SAMPLE_POLICY = JSON.stringify(
  { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:GetObject"], Resource: ["arn:aws:s3:::my-bucket/*"] }] },
  null,
  2,
);
