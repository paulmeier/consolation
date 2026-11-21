import { StatusIndicator } from "@/components/ui";

export function dbStatus(s?: string) {
  if (!s) return "-";
  if (s === "available") return <StatusIndicator type="success">Available</StatusIndicator>;
  if (s === "stopped") return <StatusIndicator type="stopped">Stopped</StatusIndicator>;
  if (["failed", "incompatible-parameters", "inaccessible-encryption-credentials", "storage-full"].includes(s)) return <StatusIndicator type="error">{s}</StatusIndicator>;
  return <StatusIndicator type="pending">{s.charAt(0).toUpperCase() + s.slice(1)}</StatusIndicator>;
}

export const ENGINES = [
  { id: "postgres", label: "PostgreSQL", port: 5432, aurora: false },
  { id: "mysql", label: "MySQL", port: 3306, aurora: false },
  { id: "mariadb", label: "MariaDB", port: 3306, aurora: false },
  { id: "aurora-postgresql", label: "Aurora (PostgreSQL Compatible)", port: 5432, aurora: true },
  { id: "aurora-mysql", label: "Aurora (MySQL Compatible)", port: 3306, aurora: true },
];
