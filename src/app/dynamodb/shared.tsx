import type { TableDescription } from "@aws-sdk/client-dynamodb";
import { StatusIndicator } from "@/components/ui";

export function keyOf(t: TableDescription, type: "HASH" | "RANGE") {
  const k = t.KeySchema?.find((s) => s.KeyType === type)?.AttributeName;
  if (!k) return "-";
  const at = t.AttributeDefinitions?.find((a) => a.AttributeName === k)?.AttributeType;
  return `${k} (${at})`;
}

export function tableStatus(s?: string) {
  if (s === "ACTIVE") return <StatusIndicator type="success">Active</StatusIndicator>;
  if (s === "CREATING" || s === "UPDATING") return <StatusIndicator type="pending">{s.charAt(0) + s.slice(1).toLowerCase()}</StatusIndicator>;
  return <StatusIndicator type="stopped">{s ?? "-"}</StatusIndicator>;
}

