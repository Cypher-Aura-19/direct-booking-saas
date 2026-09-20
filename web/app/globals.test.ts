// @vitest-environment node
//
// This suite only reads a CSS file from disk and asserts on its text — it
// touches no DOM. The project's default environment (vitest.config.mts) is
// jsdom for component tests. jsdom's global `URL` resolves a relative URL
// against a `file:` base incorrectly (it falls back to the jsdom document's
// default location, http://localhost:3000/, instead of the given base),
// which breaks `new URL("./globals.css", import.meta.url)` below. Running
// this file under the real Node environment restores Node's own `URL` and
// fixes the resolution without changing any assertion.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

const BRAND_TOKENS = [
  ["--ink", "#111318"],
  ["--surface", "#ffffff"],
  ["--surface-muted", "#f3f3f4"],
  ["--accent", "#f97316"],
  ["--text-secondary", "#6b6b72"],
  ["--hairline", "#e6e6e8"],
];

const SEMANTIC_TOKENS = ["--destructive", "--warning", "--success"];

describe("design tokens", () => {
  // @req FOUND-05
  it.each(BRAND_TOKENS)("defines %s as %s", (name, value) => {
    expect(css).toContain(`${name}: ${value}`);
  });

  // @req FOUND-05
  it("exposes every brand token as a Tailwind colour", () => {
    for (const [name] of BRAND_TOKENS) {
      expect(css).toContain(`--color-${name.slice(2)}: var(${name})`);
    }
  });

  // @req FOUND-06
  it.each(SEMANTIC_TOKENS)("defines the semantic token %s", (name) => {
    expect(css).toContain(`${name}:`);
  });

  // @req FOUND-06
  it("keeps every semantic colour distinct from the brand accent", () => {
    const accent = css.match(/--accent: (#[0-9a-f]{6})/)?.[1];
    expect(accent).toBe("#f97316");
    for (const name of SEMANTIC_TOKENS) {
      const value = css.match(new RegExp(`${name}: (#[0-9a-f]{6})`))?.[1];
      expect(value).toBeDefined();
      expect(value).not.toBe(accent);
    }
  });

  // @req FOUND-05
  it("defines the card and pill radii", () => {
    expect(css).toContain("--radius-card: 16px");
    expect(css).toContain("--radius-pill: 999px");
  });

  // @req FOUND-05
  it("ships no dark theme in Phase 1, per decision D-16", () => {
    expect(css).not.toContain("prefers-color-scheme");
  });
});

describe("Urdu typography", () => {
  // @req FOUND-09
  it("applies the Nastaliq stack to lang=ur", () => {
    expect(css).toMatch(/\[lang="ur"\]\s*\{[^}]*--font-urdu/);
  });

  // @req FOUND-09
  it("matches lang=ur exactly, so Roman Urdu is not caught by it", () => {
    expect(css).toContain('[lang="ur"]');
    expect(css).not.toContain('[lang^="ur"]');
    expect(css).not.toContain('[lang*="ur"]');
  });

  // @req FOUND-10
  it("gives Nastaliq a larger line-height than Latin body text", () => {
    const urduBlock = css.match(/\[lang="ur"\]\s*\{([^}]*)\}/)?.[1] ?? "";
    const lineHeight = Number(urduBlock.match(/line-height:\s*([\d.]+)/)?.[1]);
    expect(lineHeight).toBeGreaterThan(1.8);
  });
});
