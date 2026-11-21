"use client";

import { useEffect } from "react";

/** Marks <html data-hydrated> once the client has hydrated (used by end-to-end tests). */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
