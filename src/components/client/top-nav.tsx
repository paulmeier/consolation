"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, SERVICES } from "@/lib/services";
import { ServiceIcon } from "../service-icon";
import type { Theme } from "@/lib/theme";
import { cx } from "../ui";
import { ThemeChooser, ThemeIcon, useTheme } from "./theme";

function useClickAway(onAway: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onAway();
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onAway]);
  return ref;
}

function IconButton({ label, children, onClick, active }: { label: string; children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx("flex h-9 w-9 items-center justify-center rounded text-muted hover:bg-hover hover:text-ink", active && "bg-hover text-ink")}
    >
      {children}
    </button>
  );
}

export function TopNav({ region, regionName, account, healthy, theme: initialTheme }: { region: string; regionName: string; account: string; healthy: boolean; theme: Theme }) {
  const router = useRouter();
  const [theme] = useTheme(initialTheme);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<null | "services" | "account" | "region" | "notifications" | "theme">(null);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useClickAway(() => setSearchOpen(false));
  const menuRef = useClickAway(() => setMenu(null));

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return SERVICES;
    return SERVICES.filter((s) => `${s.name} ${s.shortName} ${s.description} ${s.id}`.toLowerCase().includes(n));
  }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && (e.key === "s" || e.key === "ß" || e.code === "KeyS")) {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setSearchOpen(false);
    setMenu(null);
    setQ("");
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-topnav">
      <div className="flex h-[52px] items-center gap-2 px-4" ref={menuRef}>
        <Link href="/" className="mr-1 flex items-center gap-2 pr-2" aria-label="Console Home">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#262420] text-sm font-black text-[#ff9900]">c</span>
          <span className="hidden text-[15px] font-bold tracking-tight text-heading sm:inline">consolation</span>
        </Link>
        <span className="h-6 w-px bg-line" />
        <div className="relative">
          <IconButton label="Services" active={menu === "services"} onClick={() => setMenu(menu === "services" ? null : "services")}>
            <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="currentColor">
              {[2, 7, 12].flatMap((y) => [2, 7, 12].map((x) => <rect key={`${x}-${y}`} x={x - 1} y={y - 1} width="3" height="3" rx="0.5" />))}
            </svg>
          </IconButton>
          {menu === "services" && (
            <div className="absolute top-11 left-0 z-50 max-h-[70vh] w-[min(720px,calc(100vw-32px))] overflow-auto rounded-xl bg-surface p-4 shadow-pop">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {CATEGORIES.map((cat) => (
                  <div key={cat}>
                    <h3 className="mb-1 text-xs font-bold tracking-wide text-subtle uppercase">{cat}</h3>
                    <ul>
                      {SERVICES.filter((s) => s.category === cat).map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => go(s.href)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-hover">
                            <ServiceIcon service={s} size={20} />
                            <span>{s.shortName}</span>
                            {!s.implemented && <span className="ml-auto text-xs text-faint">preview</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative mx-2 max-w-[540px] flex-1" ref={searchRef}>
          <svg viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3.5 3.5" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && results[cursor]) {
                go(results[cursor].href);
                inputRef.current?.blur();
              } else if (e.key === "Escape") {
                setSearchOpen(false);
                inputRef.current?.blur();
              }
            }}
            placeholder="Search"
            aria-label="Search services"
            className="h-[30px] w-full rounded border border-line-strong bg-control pr-24 pl-9 text-sm placeholder:italic placeholder:text-subtle focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent focus:outline-none"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 text-xs text-muted sm:block">[Option+S]</span>
          {searchOpen && (
            <div className="absolute top-9 right-0 left-0 z-50 max-h-[60vh] overflow-auto rounded-xl bg-surface py-2 shadow-pop">
              <p className="px-4 pb-1 text-xs font-bold text-subtle">Services</p>
              {results.length === 0 && <p className="px-4 py-2 text-muted">No results for &ldquo;{q}&rdquo;</p>}
              {results.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(s.href)}
                  className={cx("flex w-full items-start gap-3 px-4 py-2 text-left", i === cursor && "bg-hover")}
                >
                  <ServiceIcon service={s} size={28} />
                  <span className="min-w-0">
                    <span className="block font-bold text-ink">{s.shortName}</span>
                    <span className="block text-sm text-muted">{s.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Notifications" active={menu === "notifications"} onClick={() => setMenu(menu === "notifications" ? null : "notifications")}>
            <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3L4 11zM6.5 14h3" />
            </svg>
          </IconButton>
          <div className="relative">
            <IconButton label="Visual mode" active={menu === "theme"} onClick={() => setMenu(menu === "theme" ? null : "theme")}>
              <ThemeIcon theme={theme} />
            </IconButton>
            {menu === "theme" && (
              <div className="absolute top-11 right-0 z-50 w-56 rounded-xl bg-surface p-3 text-sm shadow-pop">
                <ThemeChooser initial={initialTheme} compact />
              </div>
            )}
          </div>
          <a href="https://docs.aws.amazon.com/" target="_blank" rel="noreferrer" aria-label="Help" className="flex h-9 w-9 items-center justify-center rounded text-muted hover:bg-hover hover:text-ink">
            <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M6.2 6.2a1.9 1.9 0 1 1 2.4 1.8c-.4.1-.6.5-.6.9v.6M8 11.5v.3" />
            </svg>
          </a>
          <span className="mx-1 hidden h-6 w-px bg-line md:block" />
          <div className="relative hidden md:block">
            <button type="button" onClick={() => setMenu(menu === "region" ? null : "region")} className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-bold text-ink hover:bg-hover">
              {regionName}
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M4 6h8l-4 5z" /></svg>
            </button>
            {menu === "region" && (
              <div className="absolute top-10 right-0 z-50 w-80 rounded-xl bg-surface p-4 text-sm shadow-pop">
                <p className="font-bold">{regionName}</p>
                <p className="text-muted">{region}</p>
                <p className="mt-3 text-muted">
                  The emulator serves one Region and does not keep resources separate by Region. Set <code className="font-mono">EMULATOR_REGION</code> to change the Region used for requests.
                </p>
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" onClick={() => setMenu(menu === "account" ? null : "account")} className="flex flex-col items-end rounded px-2 py-0.5 text-right leading-4 hover:bg-hover">
              <span className="flex items-center gap-1 text-xs font-bold text-ink">
                <span className={cx("inline-block h-2 w-2 rounded-full", healthy ? "bg-success" : "bg-danger")} />
                Emulator ({account})
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M4 6h8l-4 5z" /></svg>
              </span>
              <span className="text-xs text-muted">emulator</span>
            </button>
            {menu === "account" && (
              <div className="absolute top-11 right-0 z-50 w-80 rounded-xl bg-surface p-4 text-sm shadow-pop">
                <dl className="space-y-2">
                  <div><dt className="text-subtle">Account ID</dt><dd className="font-bold">{account}</dd></div>
                  <div><dt className="text-subtle">Status</dt><dd className={healthy ? "text-success" : "text-danger"}>{healthy ? "Emulator reachable" : "Emulator unreachable"}</dd></div>
                </dl>
                <Link href="/settings" onClick={() => setMenu(null)} className="mt-3 inline-block text-accent hover:underline">Emulator connection settings</Link>
              </div>
            )}
          </div>
        </div>
        {menu === "notifications" && (
          <div className="absolute top-12 right-40 z-50 w-80 rounded-xl bg-surface p-4 text-sm shadow-pop">
            <p className="font-bold">Notifications</p>
            <p className="mt-2 text-muted">No notifications. The emulator has no AWS Health events.</p>
          </div>
        )}
      </div>
    </header>
  );
}
