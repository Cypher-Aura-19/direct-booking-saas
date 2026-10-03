// @vitest-environment node
import { test, expect } from "vitest";
import { parseGuestId, sniffImage } from "./cnic";

test("a valid submission is normalised: CNIC dashed, phone stripped, name trimmed", () => {
  expect(parseGuestId({ name: "  Sana Malik ", cnic: "3520212345671", phone: "0300 555-0123" })).toEqual({
    name: "Sana Malik", cnic: "35202-1234567-1", phone: "03005550123",
  });
  expect(parseGuestId({ name: "A", cnic: "35202-1234567-1", phone: "+923005550123" })).toMatchObject({ cnic: "35202-1234567-1" });
});

test("bad names, CNICs and phones are rejected with a message", () => {
  for (const bad of [
    { name: "", cnic: "3520212345671", phone: "03005550123" },
    { name: "Sana", cnic: "123", phone: "03005550123" },
    { name: "Sana", cnic: "35202-1234567-A", phone: "03005550123" },
    { name: "Sana", cnic: "3520212345671", phone: "abc" },
  ]) {
    const result = parseGuestId(bad);
    expect("error" in result && result.error.length > 0).toBe(true);
  }
});

test("images are recognised by their magic bytes, not their name", () => {
  expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toEqual({ mime: "image/jpeg", ext: "jpg" });
  expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toEqual({ mime: "image/png", ext: "png" });
  expect(sniffImage(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toEqual({ mime: "image/webp", ext: "webp" });
  expect(sniffImage(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  expect(sniffImage(new Uint8Array(0))).toBeNull();
});
