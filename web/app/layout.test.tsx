import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// path.join (not `new URL("./layout.tsx", import.meta.url)`) because Vite
// specially rewrites that literal-first-arg pattern for browser asset
// bundling, which under the jsdom test environment resolves to an
// http://localhost URL instead of a file path.
const layoutPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "layout.tsx",
);
const source = readFileSync(layoutPath, "utf8");

describe("root layout fonts", () => {
  // @req FOUND-07
  it("loads the Latin UI font into a CSS variable", () => {
    expect(source).toContain("--font-geist-sans");
  });

  // @req FOUND-08
  it("loads Noto Nastaliq Urdu", () => {
    expect(source).toContain("Noto_Nastaliq_Urdu");
    expect(source).toContain("--font-noto-nastaliq");
  });

  // @req FOUND-08
  // @req I18N-02
  it("requests only weights 400 and 700 for Nastaliq", () => {
    const weights = source.match(/weight: \[([^\]]*)\]/)?.[1] ?? "";
    expect(weights).toContain('"400"');
    expect(weights).toContain('"700"');
    for (const banned of ['"300"', '"500"', '"600"']) {
      expect(weights).not.toContain(banned);
    }
  });

  // @req FOUND-08
  it("requests the arabic subset for Nastaliq", () => {
    expect(source).toContain('subsets: ["arabic"]');
  });
});
