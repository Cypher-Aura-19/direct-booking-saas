// @vitest-environment node
import { test, expect } from "vitest";
import { retentionCap, retentionLabel } from "./dates";

test("retentionCap is 90 days after checkout, at the start of that day in Karachi", () => {
  expect(retentionCap("2026-11-12")).toBe("2027-02-09T19:00:00.000Z");
});

// @req CNIC-14
test("the retention label counts days, says 'tomorrow' inside the last day and flags expiry", () => {
  const now = new Date("2026-10-01T00:00:00.000Z");
  expect(retentionLabel("2026-10-11T00:00:00.000Z", now)).toBe("Deletes in 10 days");
  expect(retentionLabel("2026-10-01T12:00:00.000Z", now)).toBe("Deletes tomorrow");
  expect(retentionLabel("2026-10-02T00:00:00.000Z", now)).toBe("Deletes tomorrow");
  expect(retentionLabel("2026-10-01T00:00:00.000Z", now)).toMatch(/^Expired/);
  expect(retentionLabel("2026-09-01T00:00:00.000Z", now)).toMatch(/^Expired/);
});
