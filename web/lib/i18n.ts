/**
 * The three ways a guest will address us.
 *
 * "ur-Latn" is Roman Urdu — Urdu written in Latin script. It reads left to
 * right and must never receive the Nastaliq stack, which is why locale
 * matching here is exact rather than prefix-based.
 */
export type Locale = "en" | "ur" | "ur-Latn";

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ur" ? "rtl" : "ltr";
}

export function isNastaliq(locale: Locale): boolean {
  return locale === "ur";
}
