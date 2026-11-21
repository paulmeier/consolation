"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "./use-client";
import { buttonClass } from "../ui";

export function ModalFrame({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const mounted = useIsClient();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);
  // Portals need document.body, so render only after mount (no SSR/hydration mismatch).
  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      className={`m-auto w-[calc(100%-32px)] ${size === "lg" ? "max-w-3xl" : "max-w-xl"} rounded-2xl bg-surface p-0 text-ink shadow-pop`}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
        <h2 className="text-lg font-bold text-heading">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close modal" className="rounded p-1 text-muted hover:text-ink">
          <svg viewBox="0 0 16 16" className="h-4 w-4" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>
      <div className="px-5 pb-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </dialog>,
    document.body,
  );
}

/**
 * A trigger button plus a modal whose body (usually a server-rendered <form> bound to
 * a Server Action) closes itself once the form is submitted.
 */
export function ModalButton({
  label,
  title,
  children,
  variant = "normal",
  size,
}: {
  label: ReactNode;
  title: ReactNode;
  children: ReactNode;
  variant?: "primary" | "normal";
  size?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass(variant)} onClick={() => setOpen(true)}>
        {label}
      </button>
      <ModalFrame open={open} onClose={() => setOpen(false)} title={title} size={size}>
        <div onSubmitCapture={() => setTimeout(() => setOpen(false), 0)}>{children}</div>
      </ModalFrame>
    </>
  );
}
