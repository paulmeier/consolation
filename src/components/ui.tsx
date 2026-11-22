import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "normal" | "link" | "icon" | "danger";

const BTN: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary border border-primary hover:bg-primary-hover hover:border-primary-hover disabled:bg-line disabled:border-line disabled:text-faint",
  normal:
    "bg-control text-control-ink border border-control-border hover:bg-hover hover:text-ink disabled:bg-surface disabled:text-faint disabled:border-line-strong",
  danger:
    "bg-control text-danger border border-danger hover:bg-danger-soft disabled:bg-surface disabled:text-faint disabled:border-line-strong",
  link: "text-control-ink border border-transparent hover:bg-hover",
  icon: "text-muted border border-transparent hover:text-ink px-1.5",
};

export function buttonClass(variant: Variant = "normal", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded px-3 py-[4px] text-sm font-medium leading-5 whitespace-nowrap cursor-pointer disabled:cursor-default transition-colors",
    BTN[variant],
    extra,
  );
}

export function Button({ variant = "normal", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" {...props} className={buttonClass(variant, className)} />;
}

export function LinkButton({ variant = "normal", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}

export function InfoLink() {
  return <span className="ml-2 cursor-pointer text-xs font-semibold text-accent hover:underline">Info</span>;
}

export function Header({
  variant = "h2",
  children,
  counter,
  info,
  description,
  actions,
}: {
  variant?: "h1" | "h2" | "h3";
  children: ReactNode;
  counter?: ReactNode;
  info?: boolean;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const H = variant;
  const size =
    variant === "h1"
      ? "text-2xl leading-[30px] font-bold text-heading"
      : variant === "h2"
        ? "text-lg leading-[22px] font-bold text-heading"
        : "text-base font-bold text-heading";
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <H className={cx(size, "inline")}>
          {children}
          {counter !== undefined && <span className="font-normal text-subtle"> ({counter})</span>}
        </H>
        {info && <InfoLink />}
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Container({
  header,
  children,
  footer,
  noPadding,
  className,
  id,
}: {
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("sel-scope rounded-2xl bg-surface shadow-card", className)}>
      {header && <div data-ctr="header" className="px-5 pt-4 pb-3">{header}</div>}
      {children !== undefined && <div data-ctr={noPadding ? undefined : header ? "body" : "body-only"} className={cx(!noPadding && "px-5 pb-5", !header && !noPadding && "pt-4")}>{children}</div>}
      {footer && <div className="border-t border-line px-5 py-3 text-center">{footer}</div>}
    </section>
  );
}

export function KeyValue({ items, columns = 3 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 | 4 }) {
  const cols = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }[columns];
  return (
    <dl data-kv className={cx("grid grid-cols-1 gap-x-8 gap-y-4", cols)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-sm font-bold text-muted">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-ink">{it.value ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

const STATUS = {
  success: { color: "text-success", icon: "M5 10.5l3 3 7-7" },
  error: { color: "text-danger", icon: "M6 6l8 8M14 6l-8 8" },
  pending: { color: "text-subtle", icon: "M10 5v5l3 2" },
  stopped: { color: "text-subtle", icon: "M6 10h8" },
  info: { color: "text-accent", icon: "M10 9v5M10 6v.5" },
  warning: { color: "text-warning", icon: "M10 6v5M10 13.5v.5" },
} as const;

export function StatusIndicator({ type, children }: { type: keyof typeof STATUS; children: ReactNode }) {
  const s = STATUS[type];
  return (
    <span className={cx("inline-flex items-center gap-1.5", s.color)}>
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="10" cy="10" r="8" />
        <path d={s.icon} />
      </svg>
      <span>{children}</span>
    </span>
  );
}

export function Badge({ children, color = "grey" }: { children: ReactNode; color?: "grey" | "blue" | "green" | "red" }) {
  const c = {
    grey: "bg-badge text-ink",
    blue: "bg-accent text-on-strong",
    green: "bg-success text-on-strong",
    red: "bg-danger text-on-strong",
  }[color];
  return <span className={cx("inline-block rounded px-2 text-xs leading-5", c)}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="py-6 text-center">
      <p className="font-bold text-muted">{title}</p>
      {description && <p className="mt-1 text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorAlert({ title = "Request failed", message }: { title?: string; message: string }) {
  return (
    <div className="flex gap-3 rounded-xl border-2 border-danger bg-danger-soft px-4 py-3">
      <StatusIndicator type="error">
        <span className="font-bold">{title}</span>
      </StatusIndicator>
      <span className="min-w-0 break-words text-ink">{message}</span>
    </div>
  );
}

export function Alert({ children, type = "info" }: { children: ReactNode; type?: "info" | "warning" }) {
  return (
    <div className={cx("flex gap-3 rounded-xl border-2 px-4 py-3", type === "info" ? "border-accent bg-info-soft" : "border-warning bg-warning-soft")}>
      <StatusIndicator type={type}>{""}</StatusIndicator>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const INPUT =
  "w-full rounded border border-control-border bg-surface px-3 py-[4px] text-sm leading-5 text-ink placeholder:italic placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(INPUT, props.className)} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(INPUT, "font-mono text-[13px]", props.className)} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(INPUT, "appearance-auto", props.className)} />;
}

export function FormField({
  label,
  description,
  constraint,
  children,
  htmlFor,
}: {
  label: ReactNode;
  description?: ReactNode;
  constraint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-ink">
        {label}
      </label>
      {description && <p className="text-sm text-muted">{description}</p>}
      {children}
      {constraint && <p className="text-xs text-subtle">{constraint}</p>}
    </div>
  );
}

export function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" className="ml-1 inline h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 2h4v4M14 2L7 9M12 9v5H2V4h5" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3" />
    </svg>
  );
}

export function SpaceBetween({ children, size = "l" }: { children: ReactNode; size?: "s" | "m" | "l" }) {
  return <div className={cx("flex flex-col", { s: "gap-2", m: "gap-4", l: "gap-6" }[size])}>{children}</div>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-hover px-1 font-mono text-[13px]">{children}</code>;
}
