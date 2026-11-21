"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { pushRecent } from "./recent";
import { cx } from "../ui";

export type NavItem =
  | { type: "link"; text: string; href: string; badge?: string }
  | { type: "section"; text: string; items: { text: string; href: string }[] }
  | { type: "divider" };

function NavLink({ href, text, badge, pathname }: { href: string; text: string; badge?: string; pathname: string }) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cx(
        "block rounded px-2 py-[5px] leading-5 hover:text-accent",
        active ? "font-semibold text-accent" : "text-ink",
      )}
    >
      {text}
      {badge && <span className="ml-2 text-xs font-semibold text-accent underline decoration-dashed">{badge}</span>}
    </Link>
  );
}

/** Service chrome: collapsible side navigation, breadcrumb bar and content column. */
export function ServiceShell({
  serviceId,
  title,
  homeHref,
  nav,
  crumbLabels,
  children,
}: {
  serviceId: string;
  title: string;
  homeHref: string;
  nav: NavItem[];
  /** Segment labels; null hides a segment that has no page of its own. */
  crumbLabels?: Record<string, string | null>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // null = automatic: open on wide screens, closed on narrow ones (pure CSS, no effect).
  const [navPref, setNavPref] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => pushRecent(serviceId), [serviceId]);

  // Breadcrumbs from the URL: /s3/buckets/my-bucket -> Amazon S3 / Buckets / my-bucket
  const segs = pathname.split("/").filter(Boolean).slice(1);
  const crumbs = [{ text: title, href: homeHref }];
  let acc = "/" + pathname.split("/").filter(Boolean)[0];
  for (const s of segs) {
    acc += "/" + s;
    const decoded = decodeURIComponent(s);
    if (crumbLabels && crumbLabels[s] === null) continue;
    const label = crumbLabels?.[s] ?? (/^[a-z-]+$/.test(decoded) && segs.indexOf(s) === 0 ? decoded.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : decoded);
    if (crumbs[crumbs.length - 1].text !== label) crumbs.push({ text: label, href: acc });
  }

  return (
    <div className="flex min-h-[calc(100vh-52px-36px)] flex-col">
      <div className="flex h-[41px] items-center gap-3 border-b border-line bg-surface px-3">
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setNavPref((p) => !(p ?? (typeof window !== "undefined" && window.innerWidth >= 900)))}
          className={cx(
            "flex h-8 w-8 items-center justify-center rounded text-muted hover:text-ink",
            navPref === true && "bg-accent text-white hover:text-white",
            navPref === null && "min-[900px]:bg-accent min-[900px]:text-white min-[900px]:hover:text-white",
          )}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
            <path d="M5.5 2.5v11" />
          </svg>
        </button>
        <nav aria-label="Breadcrumbs" className="min-w-0 truncate text-sm">
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-2 text-subtle">/</span>}
              {i < crumbs.length - 1 ? (
                <Link href={c.href} className="underline-link text-ink">
                  {c.text}
                </Link>
              ) : (
                <span className="text-ink">{c.text}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex flex-1">
        {navPref !== false && (
          <aside className={cx(navPref === null && "hidden min-[900px]:block", "fixed inset-y-0 left-0 z-30 mt-[93px] w-[280px] shrink-0 overflow-y-auto border-r border-line bg-surface pb-16 md:sticky md:top-[52px] md:mt-0 md:h-[calc(100vh-52px-36px)]")}>
            <div className="flex items-center justify-between px-7 pt-6 pb-3">
              <Link href={homeHref} className="text-lg font-bold text-heading">
                {title}
              </Link>
              <button type="button" aria-label="Close navigation" onClick={() => setNavPref(false)} className="text-muted hover:text-ink">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3L5 8l5 5" /></svg>
              </button>
            </div>
            <ul className="px-5">
              {nav.map((item, i) => {
                if (item.type === "divider") return <li key={i} className="my-3 border-t border-line" />;
                if (item.type === "link")
                  return (
                    <li key={i}>
                      <NavLink {...item} pathname={pathname} />
                    </li>
                  );
                const isCollapsed = collapsed[item.text];
                return (
                  <li key={i} className="mt-2">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [item.text]: !c[item.text] }))}
                      className="flex w-full items-start gap-1 py-1 text-left text-base font-bold text-heading"
                    >
                      <svg viewBox="0 0 16 16" className={cx("mt-1 h-3.5 w-3.5 shrink-0 transition-transform", !isCollapsed && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 3l5 5-5 5" />
                      </svg>
                      {item.text}
                    </button>
                    {!isCollapsed && (
                      <ul>
                        {item.items.map((l) => (
                          <li key={l.href}>
                            <NavLink {...l} pathname={pathname} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 pb-16 md:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
