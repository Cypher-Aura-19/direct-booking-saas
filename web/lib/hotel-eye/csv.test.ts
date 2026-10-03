// @vitest-environment node
import { test, expect } from "vitest";
import { recordsToCsv } from "./csv";
import type { GuestRecord } from "./records";

const base: GuestRecord = {
  id: "d1", bookingId: "b1", guestName: "Sana Malik", guestPhone: "03005550123", cnicNumber: "35202-1234567-1",
  stayStart: "2026-12-01", stayEnd: "2026-12-03", retentionExpiresAt: "2027-03-03T19:00:00.000Z", imagePath: "o/b/x.png", createdAt: "2026-11-01T00:00:00Z",
};

// @req CNIC-10
test("the CSV has a header and one row per record, with no image data", () => {
  expect(recordsToCsv([base])).toBe(
    "Guest name,CNIC number,Phone,Check-in,Check-out,Retention expires\r\n" +
    "Sana Malik,35202-1234567-1,03005550123,2026-12-01,2026-12-03,2027-03-03\r\n",
  );
  expect(recordsToCsv([])).toBe("Guest name,CNIC number,Phone,Check-in,Check-out,Retention expires\r\n");
  expect(recordsToCsv([base])).not.toContain("x.png");
});

// @req CNIC-10
test("commas and quotes are quoted, and spreadsheet formulas are neutralised", () => {
  const csv = recordsToCsv([
    { ...base, guestName: 'Khan, "Sana"' },
    { ...base, guestName: '=HYPERLINK("http://evil","x")' },
    { ...base, guestName: "@SUM(A1)", guestPhone: "+923005550123" },
  ]);
  const lines = csv.trimEnd().split("\r\n");
  expect(lines[1]).toContain('"Khan, ""Sana"""');
  expect(lines[2]).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
  expect(lines[3]).toContain("'@SUM(A1)");
  expect(lines[3]).toContain(",+923005550123,"); // a plain +digits phone is left alone
});
