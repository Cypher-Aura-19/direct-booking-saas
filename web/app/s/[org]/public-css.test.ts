// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "public.css"), "utf8");

// @req PUB-08
it("public styles are mobile-first: wider layouts only ever widen, via min-width", () => {
  expect(css).toMatch(/@media \(min-width:/);
  expect(css).not.toMatch(/@media[^{]*max-width/);
});
