"use client";

import { useEffect, useState } from "react";
import { ModalFrame } from "./modal";
import { buttonClass, cx } from "../ui";

type Prefs = { pageSize: number; hidden: string[]; wrap: boolean; striped: boolean };
const DEFAULT_PREFS: Prefs = { pageSize: 20, hidden: [], wrap: true, striped: false };
const PAGE_SIZES = [10, 20, 50, 100];

function loadPrefs(id: string): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(`consolation.table.${id}`) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

function sortKey(td: Element | undefined): string {
  if (!td) return "";
  const el = td as HTMLElement;
  if (el.dataset.sort !== undefined) return el.dataset.sort;
  const time = el.querySelector("time");
  if (time) return time.dateTime;
  return (el.textContent ?? "").trim();
}

function compare(a: string, b: string) {
  const na = Number(a);
  const nb = Number(b);
  if (a !== "" && b !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Cloudscape-style table toolbar for a server-rendered <Table id={tableId}>:
 * text filter, sortable headers, pagination and a preferences modal
 * (page size, visible columns, wrap lines, striped rows) saved per table.
 */
export function TableFilter({ tableId, placeholder }: { tableId: string; placeholder: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ col: string; dir: "ascending" | "descending" } | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [info, setInfo] = useState({ matches: 0, total: 0, pages: 1 });
  const [columns, setColumns] = useState<{ id: string; label: string }[]>([]);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState<Prefs>(DEFAULT_PREFS);

  // Apply filter, sort, pagination and column visibility to the DOM rows.
  function sync() {
    const table = document.getElementById(tableId)?.querySelector("table");
    const tbody = table?.querySelector("tbody");
    if (!table || !tbody) return;
    const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row]"));
    if (sort) {
      const { col, dir } = sort;
      const sorted = [...rows].sort((a, b) => {
        const r = compare(sortKey(a.querySelector(`td[data-col="${col}"]`) ?? undefined), sortKey(b.querySelector(`td[data-col="${col}"]`) ?? undefined));
        return dir === "ascending" ? r : -r;
      });
      if (sorted.some((r, i) => r !== rows[i])) sorted.forEach((r) => tbody.appendChild(r));
      rows.splice(0, rows.length, ...sorted);
    }
    const needle = q.trim().toLowerCase();
    const matching = rows.filter((r) => !needle || (r.dataset.filter ?? r.textContent ?? "").toLowerCase().includes(needle));
    const pages = Math.max(1, Math.ceil(matching.length / prefs.pageSize));
    const current = Math.min(page, pages);
    const visible = new Set(matching.slice((current - 1) * prefs.pageSize, current * prefs.pageSize));
    rows.forEach((r, i) => {
      r.dataset.hidden = visible.has(r) ? "false" : "true";
      r.dataset.stripe = prefs.striped && i % 2 === 1 ? "true" : "false";
    });
    table.querySelectorAll<HTMLElement>("th[data-col]").forEach((th) => {
      th.setAttribute("aria-sort", sort && sort.col === th.dataset.col ? sort.dir : "none");
    });
    table.dataset.wrap = prefs.wrap ? "true" : "false";
    let style = document.getElementById(`${tableId}-prefs-style`);
    if (!style) {
      style = document.createElement("style");
      style.id = `${tableId}-prefs-style`;
      document.head.appendChild(style);
    }
    style.textContent = prefs.hidden.map((c) => `#${CSS.escape(tableId)} [data-col="${c}"]{display:none}`).join("\n");
    return { matches: matching.length, total: rows.length, pages };
  }

  // Re-apply whenever the server re-renders the rows (after a Server Action).
  useEffect(() => {
    const tbody = document.getElementById(tableId)?.querySelector("tbody");
    const table = document.getElementById(tableId)?.querySelector("table");
    if (!tbody || !table) return;
    const run = () => {
      const r = sync();
      if (r) setInfo(r);
    };
    const frame = requestAnimationFrame(() => {
      if (!prefsLoaded) {
        setPrefs(loadPrefs(tableId));
        setPrefsLoaded(true);
      }
      setColumns(
        Array.from(table.querySelectorAll<HTMLElement>("th[data-col]")).map((th) => ({ id: th.dataset.col!, label: th.dataset.label ?? th.textContent ?? `Column ${th.dataset.col}` })),
      );
      run();
    });
    const obs = new MutationObserver(run);
    obs.observe(tbody, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync reads exactly these values
  }, [tableId, prefsLoaded, q, page, sort, prefs]);

  // Clickable sortable headers.
  useEffect(() => {
    const table = document.getElementById(tableId)?.querySelector("table");
    if (!table) return;
    const ths = Array.from(table.querySelectorAll<HTMLElement>("th[data-sortable]"));
    const handlers = ths.map((th) => {
      const h = () =>
        setSort((s) => ({ col: th.dataset.col!, dir: s && s.col === th.dataset.col && s.dir === "ascending" ? "descending" : "ascending" }));
      th.addEventListener("click", h);
      th.tabIndex = 0;
      const k = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          h();
        }
      };
      th.addEventListener("keydown", k);
      return () => {
        th.removeEventListener("click", h);
        th.removeEventListener("keydown", k);
      };
    });
    return () => handlers.forEach((off) => off());
  }, [tableId]);

  function savePrefs(p: Prefs) {
    setPrefs(p);
    setPage(1);
    try {
      localStorage.setItem(`consolation.table.${tableId}`, JSON.stringify(p));
    } catch {
      /* storage unavailable */
    }
  }

  const current = Math.min(page, info.pages);
  const pageButtons = Array.from({ length: info.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === info.pages || Math.abs(n - current) <= 2);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xl">
        <svg viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded border border-control-border bg-surface py-[4px] pr-3 pl-9 text-sm leading-5 placeholder:italic placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
        />
      </div>
      {q.trim() && <span className="text-sm whitespace-nowrap text-muted">{info.matches} match{info.matches === 1 ? "" : "es"}</span>}
      <nav aria-label="Pagination" className="ml-auto flex items-center gap-1 text-sm">
        <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded px-1.5 py-1 text-muted hover:text-ink disabled:text-line-strong">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3L5 8l5 5" /></svg>
        </button>
        {pageButtons.map((n, i) => (
          <span key={n} className="flex items-center">
            {i > 0 && n - pageButtons[i - 1] > 1 && <span className="px-1 text-subtle">…</span>}
            <button
              type="button"
              aria-label={`Page ${n}`}
              aria-current={n === current ? "page" : undefined}
              onClick={() => setPage(n)}
              className={cx("min-w-6 rounded px-1.5 py-0.5", n === current ? "font-bold text-ink" : "text-muted hover:text-ink")}
            >
              {n}
            </button>
          </span>
        ))}
        <button type="button" aria-label="Next page" disabled={current >= info.pages} onClick={() => setPage(current + 1)} className="rounded px-1.5 py-1 text-muted hover:text-ink disabled:text-line-strong">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5" /></svg>
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button
          type="button"
          aria-label="Preferences"
          onClick={() => {
            setDraft(prefs);
            setPrefsOpen(true);
          }}
          className="rounded p-1 text-muted hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="2.2" />
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
          </svg>
        </button>
      </nav>
      <ModalFrame
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Preferences"
        size="lg"
        footer={
          <>
            <button type="button" className={buttonClass("link")} onClick={() => setPrefsOpen(false)}>Cancel</button>
            <button
              type="button"
              className={buttonClass("primary")}
              onClick={() => {
                savePrefs(draft);
                setPrefsOpen(false);
              }}
            >
              Confirm
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 font-bold">Page size</legend>
              {PAGE_SIZES.map((n) => (
                <label key={n} className="flex items-center gap-2 py-0.5">
                  <input type="radio" name="pageSize" checked={draft.pageSize === n} onChange={() => setDraft({ ...draft, pageSize: n })} className="accent-accent" />
                  {n} resources
                </label>
              ))}
            </fieldset>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={draft.wrap} onChange={(e) => setDraft({ ...draft, wrap: e.target.checked })} className="mt-1 accent-accent" />
              <span><b>Wrap lines</b><span className="block text-sm text-muted">Select to see all the text and wrap the lines</span></span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={draft.striped} onChange={(e) => setDraft({ ...draft, striped: e.target.checked })} className="mt-1 accent-accent" />
              <span><b>Striped rows</b><span className="block text-sm text-muted">Select to add alternating shaded rows</span></span>
            </label>
          </div>
          <fieldset>
            <legend className="mb-2 font-bold">Column preferences</legend>
            <p className="mb-2 text-sm text-muted">Customize the columns visibility.</p>
            {columns.map((c, i) => (
              <label key={c.id} className="flex items-center justify-between gap-3 border-b border-line-soft py-1.5">
                <span>{c.label}</span>
                <input
                  type="checkbox"
                  disabled={i === 0}
                  checked={!draft.hidden.includes(c.id)}
                  onChange={(e) => setDraft({ ...draft, hidden: e.target.checked ? draft.hidden.filter((h) => h !== c.id) : [...draft.hidden, c.id] })}
                  className="accent-accent"
                />
              </label>
            ))}
          </fieldset>
        </div>
      </ModalFrame>
    </div>
  );
}
