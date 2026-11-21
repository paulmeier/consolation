import { CATEGORY_COLORS, type Service } from "@/lib/services";
import { cx } from "./ui";

/** Generic category-colored tile; deliberately not the official AWS service artwork. */
export function ServiceIcon({ service, size = 24 }: { service: Service; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.36) }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[4px] bg-gradient-to-tr font-bold leading-none text-white",
        CATEGORY_COLORS[service.category],
      )}
      aria-hidden
    >
      {service.abbr}
    </span>
  );
}
