import type { ReactNode } from "react";
import { cx } from "./ui";

export type Column<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  width?: string;
  className?: string;
  /** Value used for sorting; defaults to the cell's text (or its <time dateTime>). */
  sortValue?: (row: T) => string | number | undefined;
  /** Set false for action columns. */
  sortable?: boolean;
};

/**
 * Cloudscape-style table. Selection inputs are bound to an external <form id={formId}>
 * through the HTML `form` attribute, so header action buttons (also `form={formId}`)
 * submit the selected rows to a Server Action with no client state.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  filterText,
  selection,
  formId,
  empty,
  id,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  filterText?: (row: T) => string;
  selection?: "single" | "multi";
  formId?: string;
  empty?: ReactNode;
  id?: string;
}) {
  return (
    <div className="overflow-x-auto" id={id}>
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {selection && <th className="w-10 border-b border-line bg-surface py-1.5 pl-5" />}
            {columns.map((c, i) => (
              <th
                key={i}
                data-col={i}
                data-label={typeof c.header === "string" ? c.header : undefined}
                data-sortable={c.sortable === false ? undefined : ""}
                style={c.width ? { width: c.width } : undefined}
                className={cx(
                  "border-b border-line bg-surface py-[6px] pr-3 font-medium text-muted",
                  i === 0 && !selection ? "pl-5" : "pl-2",
                  i > 0 && "border-l border-l-line-soft",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)} className="px-5">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr key={key} data-row data-filter={filterText ? filterText(row).toLowerCase() : undefined} className="group">
                {selection && (
                  <td className="border-b border-line-soft py-2 pl-5 align-top">
                    <input
                      type={selection === "single" ? "radio" : "checkbox"}
                      name="selected"
                      value={key}
                      form={formId}
                      data-select
                      aria-label={`Select ${key}`}
                      className="mt-0.5 h-4 w-4 accent-accent"
                    />
                  </td>
                )}
                {columns.map((c, i) => (
                  <td
                    key={i}
                    data-col={i}
                    data-sort={c.sortValue ? String(c.sortValue(row) ?? "") : undefined}
                    className={cx(
                      "border-b border-line-soft py-2 pr-3 align-top break-words",
                      i === 0 && !selection ? "pl-5" : "pl-2",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
