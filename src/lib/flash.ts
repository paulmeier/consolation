import "server-only";
import { cookies } from "next/headers";

export type Flash = { type: "success" | "error" | "info"; message: string; id: number };
const COOKIE = "consolation_flash";

/** Queue a one-time notification shown at the top of the next rendered page. */
export async function flash(type: Flash["type"], message: string) {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify({ type, message, id: Date.now() }), { path: "/", maxAge: 60, httpOnly: false, sameSite: "lax" });
}

export async function readFlash(): Promise<Flash | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Flash;
  } catch {
    return null;
  }
}

export const FLASH_COOKIE = COOKIE;
