import type { Tag } from "@aws-sdk/client-ec2";
import { StatusIndicator } from "@/components/ui";

export const nameTag = (tags?: Tag[]) => tags?.find((t) => t.Key === "Name")?.Value ?? "–";

export function ec2State(s?: string) {
  if (!s) return "-";
  const v = s.toLowerCase();
  if (["available", "attached", "active", "in-use"].includes(v)) return <StatusIndicator type="success">{s.charAt(0).toUpperCase() + s.slice(1)}</StatusIndicator>;
  if (["pending", "attaching", "detaching", "deleting", "pending-acceptance", "provisioning", "initiating-request"].includes(v)) return <StatusIndicator type="pending">{s}</StatusIndicator>;
  if (["failed", "rejected", "expired"].includes(v)) return <StatusIndicator type="error">{s}</StatusIndicator>;
  if (["deleted", "detached"].includes(v)) return <StatusIndicator type="stopped">{s}</StatusIndicator>;
  return s;
}
