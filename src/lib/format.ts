export function formatDate(d?: Date | string | number | null) {
  if (d === undefined || d === null || d === "") return "-";
  const date = d instanceof Date ? d : new Date(typeof d === "string" && /^\d+$/.test(d) ? Number(d) * 1000 : d);
  if (Number.isNaN(date.getTime())) return String(d);
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(tz) / 60)).padStart(2, "0");
  const mm = String(Math.abs(tz) % 60).padStart(2, "0");
  return (
    date.toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }) + ` (UTC${sign}${hh}:${mm})`
  );
}

export function formatBytes(n?: number | null) {
  if (n === undefined || n === null) return "-";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export function regionLabel(region: string) {
  const names: Record<string, string> = {
    "us-east-1": "US East (N. Virginia)",
    "us-east-2": "US East (Ohio)",
    "us-west-1": "US West (N. California)",
    "us-west-2": "US West (Oregon)",
    "eu-west-1": "Europe (Ireland)",
    "eu-central-1": "Europe (Frankfurt)",
  };
  return names[region] ?? region;
}
