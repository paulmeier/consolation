"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SERVICES } from "@/lib/services";
import { ServiceIcon } from "../service-icon";
import { RECENT_KEY } from "./recent";

export function RecentlyVisited() {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => {
      try {
        return localStorage.getItem(RECENT_KEY) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => null,
  );
  let ids: string[] | null = null;
  try {
    ids = raw === null ? null : (JSON.parse(raw) as string[]);
  } catch {
    ids = [];
  }
  const list = (ids ?? []).map((id) => SERVICES.find((s) => s.id === id)).filter((s) => !!s);
  const shown = list.length ? list : SERVICES.filter((s) => s.implemented);
  return (
    <div>
      {ids !== null && list.length === 0 && <p className="mb-2 text-sm text-muted">No recently visited services. Popular services:</p>}
      <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        {shown.slice(0, 12).map((s) => (
          <li key={s.id} className="border-b border-line-soft py-2.5">
            <Link href={s.href} className="flex items-center gap-3">
              <ServiceIcon service={s} size={24} />
              <span className="underline-link">{s.shortName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
