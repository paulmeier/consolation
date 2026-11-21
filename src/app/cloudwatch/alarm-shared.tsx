import { StatusIndicator } from "@/components/ui";

export const OPERATORS: [string, string, string][] = [
  ["GreaterThanThreshold", "Greater than", ">"],
  ["GreaterThanOrEqualToThreshold", "Greater than or equal to", ">="],
  ["LessThanThreshold", "Less than", "<"],
  ["LessThanOrEqualToThreshold", "Less than or equal to", "<="],
];

export function alarmState(s?: string) {
  if (s === "ALARM") return <StatusIndicator type="error">In alarm</StatusIndicator>;
  if (s === "OK") return <StatusIndicator type="success">OK</StatusIndicator>;
  return <StatusIndicator type="pending">Insufficient data</StatusIndicator>;
}
