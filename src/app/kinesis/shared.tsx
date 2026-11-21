import { StatusIndicator } from "@/components/ui";

export function streamStatus(s?: string) {
  if (s === "ACTIVE") return <StatusIndicator type="success">Active</StatusIndicator>;
  if (s === "CREATING" || s === "UPDATING" || s === "DELETING") return <StatusIndicator type="pending">{s.charAt(0) + s.slice(1).toLowerCase()}</StatusIndicator>;
  return s ?? "-";
}
