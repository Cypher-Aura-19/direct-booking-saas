import { covers, eachNight, isIsoDate, type DateRange } from "./dates";

export type RateRule = DateRange & { rateCents: number; minimumStay: number };
export type QuoteInput = { baseRateCents: number; minimumStay: number; rules: RateRule[]; blocks: DateRange[]; today: string };
export type Quote =
  | { ok: true; nights: number; totalCents: number; breakdown: { night: string; rateCents: number }[]; minimumStay: number }
  | { ok: false; reason: "invalid" | "past" | "unavailable" | "minimum_stay"; minimumStay: number };

export function nightStatus(night: string, input: Pick<QuoteInput, "blocks" | "today">): "available" | "blocked" | "past" {
  if (night < input.today) return "past";
  return input.blocks.some((b) => covers(b, night)) ? "blocked" : "available";
}

export function requiredMinimumStay(checkIn: string, input: Pick<QuoteInput, "minimumStay" | "rules">): number {
  const rule = input.rules.find((r) => covers(r, checkIn));
  return Math.max(input.minimumStay, rule?.minimumStay ?? 1);
}

// The one price calculation. Host pages, the public page and M10's
// server-computed booking price all call this.
export function quoteStay(checkIn: string, checkOut: string, input: QuoteInput): Quote {
  const valid = isIsoDate(checkIn) && isIsoDate(checkOut) && checkOut > checkIn;
  const minimumStay = valid ? requiredMinimumStay(checkIn, input) : input.minimumStay;
  if (!valid) return { ok: false, reason: "invalid", minimumStay };
  if (checkIn < input.today) return { ok: false, reason: "past", minimumStay };
  const nights = eachNight({ start: checkIn, end: checkOut });
  if (nights.some((n) => nightStatus(n, input) !== "available")) return { ok: false, reason: "unavailable", minimumStay };
  if (nights.length < minimumStay) return { ok: false, reason: "minimum_stay", minimumStay };
  const breakdown = nights.map((night) => ({
    night,
    rateCents: input.rules.find((r) => covers(r, night))?.rateCents ?? input.baseRateCents,
  }));
  return { ok: true, nights: nights.length, totalCents: breakdown.reduce((s, n) => s + n.rateCents, 0), breakdown, minimumStay };
}

// The last date a guest who checks in on `checkIn` may pick as checkout: the
// morning of the first unavailable night after it (checkout happens before
// that night starts), or `horizon` when nothing is blocked before it.
export function lastCheckout(checkIn: string, input: Pick<QuoteInput, "blocks">, horizon: string): string {
  return input.blocks.reduce((last, b) => (b.start > checkIn && b.start < last ? b.start : last), horizon);
}
