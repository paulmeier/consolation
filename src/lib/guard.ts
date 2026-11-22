import { revalidatePath } from "next/cache";
import { errorMessage } from "./emulator";
import { flash } from "./flash";

/**
 * Run a mutation from a Server Action: flash `ok` on success or the error message on
 * failure, then revalidate the given paths. Returns whether it succeeded.
 */
export async function guard(ok: string, paths: string | string[], fn: () => Promise<unknown>): Promise<boolean> {
  let success = true;
  try {
    await fn();
    await flash("success", ok);
  } catch (e) {
    success = false;
    await flash("error", errorMessage(e));
  }
  for (const p of Array.isArray(paths) ? paths : [paths]) revalidatePath(p);
  return success;
}

/** Parse optional JSON from a form field; throws a readable error. */
export function parseJson(text: string, what = "JSON"): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${what} is not valid JSON: ${(e as Error).message}`);
  }
}

/** Key/value JSON from the KeyValueEditor into a string map. */
export function kvMap(raw: FormDataEntryValue | null): Record<string, string> {
  if (!raw) return {};
  const o = JSON.parse(String(raw)) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(o).filter(([k]) => k).map(([k, v]) => [k, String(v ?? "")]));
}
