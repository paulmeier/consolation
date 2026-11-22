import type { ReactNode } from "react";
import { readFlash } from "@/lib/flash";
import { Flashbar } from "./client/flashbar";

/** Standard content column: flash notifications, then the page body. */
export async function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const flash = await readFlash();
  return (
    <div className={wide ? "max-w-none" : "mx-auto max-w-[1280px]"}>
      <Flashbar initial={flash} />
      <div data-page-stack className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
