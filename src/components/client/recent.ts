"use client";

export const RECENT_KEY = "consolation.recent";
const KEY = RECENT_KEY;

export function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function pushRecent(id: string) {
  try {
    const list = [id, ...readRecent().filter((x) => x !== id)].slice(0, 12);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}
