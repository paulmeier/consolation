import { StatusIndicator } from "@/components/ui";

export function keyState(s?: string) {
  switch (s) {
    case "Enabled":
      return <StatusIndicator type="success">Enabled</StatusIndicator>;
    case "Disabled":
      return <StatusIndicator type="stopped">Disabled</StatusIndicator>;
    case "PendingDeletion":
      return <StatusIndicator type="warning">Pending deletion</StatusIndicator>;
    case "Creating":
    case "Updating":
    case "PendingImport":
      return <StatusIndicator type="pending">{s}</StatusIndicator>;
    default:
      return s ?? "-";
  }
}
