"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true after hydration, false during SSR, without a setState-in-effect round trip. */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}
