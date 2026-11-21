import { cookies } from "next/headers";

export type Theme = "light" | "dark" | "system";
export const THEME_COOKIE = "consolation_theme";

export function parseTheme(v: string | undefined): Theme {
  return v === "light" || v === "dark" ? v : "system";
}

/** The visual mode saved in the theme cookie (defaults to following the browser). */
export async function getTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
