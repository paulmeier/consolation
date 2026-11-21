"use client";

import { useState, type ReactNode } from "react";
import { ModalFrame } from "./modal";
import { buttonClass, cx } from "../ui";

/**
 * Header action that acts on the rows selected in `formId` after a Cloudscape-style
 * confirmation ("To confirm deletion, type *delete*").
 */
export function ConfirmAction({
  formId,
  action,
  label,
  title,
  noun,
  confirmWord = "delete",
  confirmLabel = "Delete",
  description,
  extra,
}: {
  formId: string;
  action: (fd: FormData) => void | Promise<void>;
  label: string;
  title: string;
  noun: string;
  confirmWord?: string;
  confirmLabel?: string;
  description?: ReactNode;
  extra?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [typed, setTyped] = useState("");

  function openModal() {
    const els = document.querySelectorAll<HTMLInputElement>(`input[form="${CSS.escape(formId)}"][data-select]:checked`);
    setSelected(Array.from(els).map((e) => e.value));
    setTyped("");
    setOpen(true);
  }

  return (
    <>
      <button type="button" className={cx(buttonClass("normal"), "needs-selection")} onClick={openModal}>
        {label}
      </button>
      <ModalFrame open={open} onClose={() => setOpen(false)} title={title}>
        <form
          action={action}
          onSubmit={() => setTimeout(() => setOpen(false), 0)}
          className="space-y-4"
        >
          {selected.map((s) => (
            <input key={s} type="hidden" name="selected" value={s} />
          ))}
          {Object.entries(extra ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <p>
            {description ?? (
              <>
                Permanently {confirmLabel.toLowerCase()} {selected.length === 1 ? `${noun}` : `${selected.length} ${noun}s`}?
              </>
            )}
          </p>
          <ul className="max-h-40 list-disc overflow-auto pl-6 font-bold break-all">
            {selected.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <div className="space-y-1">
            <label className="block text-sm">
              To confirm, type <i className="font-bold">{confirmWord}</i> in the field.
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              className="w-full rounded border border-control-border px-3 py-[4px] focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button type="button" className={buttonClass("link")} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={buttonClass("primary")} disabled={typed !== confirmWord || selected.length === 0}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </ModalFrame>
    </>
  );
}
