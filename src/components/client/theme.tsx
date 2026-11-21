"use client";

import { useSyncExternalStore } from "react";
import type { Theme } from "@/lib/theme";
import { cx } from "../ui";

export const THEME_OPTIONS: { value: Theme; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Always use the light visual mode." },
  { value: "dark", label: "Dark", description: "Always use the dark visual mode." },
  { value: "system", label: "Browser default", description: "Follow the light or dark setting of your browser or operating system." },
];

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

function read(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

/** Current visual mode; `initial` is what the server rendered from the cookie. */
export function useTheme(initial: Theme): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, () => initial);
  return [theme, setTheme];
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.cookie = `consolation_theme=${t}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeIcon({ theme, className = "h-[18px] w-[18px]" }: { theme: Theme; className?: string }) {
  if (theme === "dark")
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />
      </svg>
    );
  if (theme === "light")
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 1.5v13A6.5 6.5 0 0 0 8 1.5z" fill="currentColor" />
    </svg>
  );
}

/** Radio group used on the settings page and in the top navigation menu. */
export function ThemeChooser({ initial, compact }: { initial: Theme; compact?: boolean }) {
  const [theme, set] = useTheme(initial);
  return (
    <fieldset className={cx("flex flex-col", compact ? "gap-0.5" : "gap-3")}>
      <legend className={cx("font-bold", compact ? "mb-1 text-sm" : "mb-2")}>Visual mode</legend>
      {THEME_OPTIONS.map((o) => (
        <label key={o.value} className={cx("flex cursor-pointer items-start gap-2", compact && "rounded px-1 py-1 hover:bg-hover")}>
          <input
            type="radio"
            name={compact ? "theme-menu" : "theme"}
            value={o.value}
            aria-label={o.label}
            checked={theme === o.value}
            onChange={() => set(o.value)}
            className="mt-[3px] accent-accent"
          />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <ThemeIcon theme={o.value} className="h-3.5 w-3.5 text-muted" />
              {o.label}
            </span>
            {!compact && <span className="text-sm text-muted">{o.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
