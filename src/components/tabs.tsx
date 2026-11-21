import Link from "next/link";
import { cx } from "./ui";

/** URL-driven tabs (?tab=id), styled like Cloudscape tabs. */
export function Tabs({ tabs, active, base }: { tabs: { id: string; label: string }[]; active: string; base: string }) {
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => (
        <Link
          key={t.id}
          href={i === 0 ? base : `${base}${sep}tab=${t.id}`}
          className={cx(
            "-mb-px border-b-[3px] px-4 py-2 text-sm font-semibold whitespace-nowrap",
            t.id === active ? "border-accent text-accent" : "border-transparent text-ink hover:text-accent",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
