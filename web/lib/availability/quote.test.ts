// @vitest-environment node
import { describe, expect, it } from "vitest";
import { nightStatus, quoteStay, requiredMinimumStay, type QuoteInput } from "./quote";

const input: QuoteInput = {
  baseRateCents: 1_000_000,
  minimumStay: 2,
  today: "2026-10-01",
  rules: [{ start: "2026-12-20", end: "2027-01-03", rateCents: 2_000_000, minimumStay: 3 }],
  blocks: [{ start: "2026-10-10", end: "2026-10-12" }],
};

describe("quoteStay", () => {
  // @req CAL-09
  it("prices each night at the seasonal rate when a rule covers it, otherwise the base rate", () => {
    const q = quoteStay("2026-12-18", "2026-12-22", input);
    expect(q).toMatchObject({ ok: true, nights: 4, totalCents: 1_000_000 * 2 + 2_000_000 * 2 });
    if (q.ok) expect(q.breakdown.map((n) => n.rateCents)).toEqual([1_000_000, 1_000_000, 2_000_000, 2_000_000]);
  });

  // @req CAL-05
  it("enforces the larger of the property and seasonal minimum stay for the check-in night", () => {
    expect(requiredMinimumStay("2026-11-01", input)).toBe(2);
    expect(requiredMinimumStay("2026-12-24", input)).toBe(3);
    expect(quoteStay("2026-11-01", "2026-11-02", input)).toEqual({ ok: false, reason: "minimum_stay", minimumStay: 2 });
    expect(quoteStay("2026-12-24", "2026-12-26", input)).toEqual({ ok: false, reason: "minimum_stay", minimumStay: 3 });
  });

  // @req CAL-08
  it("refuses a stay that includes a blocked night, but allows checking out on one", () => {
    expect(quoteStay("2026-10-09", "2026-10-11", input)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(quoteStay("2026-10-08", "2026-10-10", input)).toMatchObject({ ok: true, nights: 2 });
    expect(nightStatus("2026-10-11", input)).toBe("blocked");
    expect(nightStatus("2026-10-12", input)).toBe("available");
    expect(nightStatus("2026-09-30", input)).toBe("past");
  });

  it("rejects invalid and past ranges", () => {
    expect(quoteStay("2026-10-20", "2026-10-20", input)).toMatchObject({ ok: false, reason: "invalid" });
    expect(quoteStay("nope", "2026-10-20", input)).toMatchObject({ ok: false, reason: "invalid" });
    expect(quoteStay("2026-09-20", "2026-09-25", input)).toMatchObject({ ok: false, reason: "past" });
  });
});
