// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PHOTO_WIDTHS, fitWithin, variantPath } from "./photo-variants";

describe("photo variants", () => {
  // @req PUB-07
  it("names each variant after the original, by width, as WebP", () => {
    expect(variantPath("p1/abc.jpg", 960)).toBe("p1/abc.w960.webp");
    expect(variantPath("p1/abc.webp", 480)).toBe("p1/abc.w480.webp");
    expect(PHOTO_WIDTHS).toEqual([480, 960, 1600]);
  });

  // @req PUB-07
  it("scales down to fit the target width, keeps the aspect ratio, and never upscales", () => {
    expect(fitWithin(4000, 3000, 960)).toEqual({ width: 960, height: 720 });
    expect(fitWithin(800, 600, 960)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(3000, 4000, 480)).toEqual({ width: 480, height: 640 });
  });
});
