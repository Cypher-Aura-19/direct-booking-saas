// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays, covers, daysInMonth, eachNight, isIsoDate, monthStart, nightsBetween, overlaps } from "./dates";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
  it("counts and lists nights with an exclusive end", () => {
    expect(nightsBetween("2026-10-12", "2026-10-15")).toBe(3);
    expect(eachNight({ start: "2026-10-12", end: "2026-10-15" })).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
  });
  it("covers and overlaps treat the end as the checkout morning", () => {
    const r = { start: "2026-10-12", end: "2026-10-15" };
    expect(covers(r, "2026-10-14")).toBe(true);
    expect(covers(r, "2026-10-15")).toBe(false);
    expect(overlaps(r, { start: "2026-10-15", end: "2026-10-16" })).toBe(false);
    expect(overlaps(r, { start: "2026-10-14", end: "2026-10-16" })).toBe(true);
  });
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-2-3")).toBe(false);
  });
  it("finds month boundaries", () => {
    expect(monthStart("2026-10-17")).toBe("2026-10-01");
    expect(daysInMonth("2028-02-01")).toBe(29);
    expect(daysInMonth("2026-12-10")).toBe(31);
    expect(daysInMonth("2027-02-01")).toBe(28);
  });
  it("validates leap-day dates strictly", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2024-02-29")).toBe(true);
  });
});
