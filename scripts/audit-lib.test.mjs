import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseRegistry,
  scanTags,
  findUnknownTags,
  summarise,
} from "./audit-lib.mjs";

const REGISTRY = `
# Phase 1 Requirement Registry

Some prose that mentions AI-11 but is not a table row.

## M1 — Foundation

| ID | Requirement |
|---|---|
| FOUND-01 | Repository has a root workspace |
| FOUND-02 | Next.js app builds |

## M2 — Data model

| ID | Requirement |
|---|---|
| DB-01 | organizations table exists |

## Cross-cutting

| ID | Requirement |
|---|---|
| SEC-01 | The service-role key never reaches client code |

## Totals

| Milestone | Requirements |
|---|---|
| M1 Foundation | 2 |
`;

describe("parseRegistry", () => {
  // @req FOUND-12
  test("reads every requirement row", () => {
    const rows = parseRegistry(REGISTRY);
    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((r) => r.id),
      ["FOUND-01", "FOUND-02", "DB-01", "SEC-01"],
    );
  });

  // @req FOUND-12
  test("attributes each requirement to its milestone", () => {
    const rows = parseRegistry(REGISTRY);
    assert.equal(rows.find((r) => r.id === "FOUND-01").milestone, "M1");
    assert.equal(rows.find((r) => r.id === "DB-01").milestone, "M2");
    assert.equal(
      rows.find((r) => r.id === "SEC-01").milestone,
      "Cross-cutting",
    );
  });

  // @req FOUND-12
  test("ignores the totals table", () => {
    const rows = parseRegistry(REGISTRY);
    assert.ok(!rows.some((r) => r.requirement === "2"));
  });

  // @req FOUND-12
  test("ignores requirement ids mentioned in prose", () => {
    const rows = parseRegistry(REGISTRY);
    assert.ok(!rows.some((r) => r.id === "AI-11"));
  });
});

describe("scanTags", () => {
  // @req FOUND-13
  test("finds a tag above a test", () => {
    const tags = scanTags([
      { path: "a.test.ts", content: "// @req FOUND-01\nit('works', ...)" },
    ]);
    assert.deepEqual(tags.get("FOUND-01"), ["a.test.ts"]);
  });

  // @req FOUND-13
  test("records every file that tags the same requirement", () => {
    const tags = scanTags([
      { path: "a.test.ts", content: "// @req FOUND-01" },
      { path: "b.test.ts", content: "// @req FOUND-01" },
    ]);
    assert.deepEqual(tags.get("FOUND-01"), ["a.test.ts", "b.test.ts"]);
  });

  // @req FOUND-13
  test("finds several tags in one file", () => {
    const tags = scanTags([
      { path: "a.test.ts", content: "// @req FOUND-01\n// @req DB-01" },
    ]);
    assert.deepEqual([...tags.keys()], ["FOUND-01", "DB-01"]);
  });

  // @req FOUND-13
  test("returns an empty map when nothing is tagged", () => {
    assert.equal(scanTags([{ path: "a.test.ts", content: "it()" }]).size, 0);
  });
});

describe("findUnknownTags", () => {
  // @req FOUND-12
  test("flags a tag whose id is absent from the registry", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([
      { path: "a.test.ts", content: "// @req FOUND-99" },
    ]);
    assert.deepEqual(findUnknownTags(tags, registry), [
      { id: "FOUND-99", path: "a.test.ts" },
    ]);
  });

  // @req FOUND-12
  test("accepts a tag that exists", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([
      { path: "a.test.ts", content: "// @req FOUND-01" },
    ]);
    assert.deepEqual(findUnknownTags(tags, registry), []);
  });
});

describe("summarise", () => {
  // @req FOUND-16
  test("counts covered requirements and a percentage", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([
      { path: "a.test.ts", content: "// @req FOUND-01\n// @req DB-01" },
    ]);
    const summary = summarise(registry, tags);
    assert.equal(summary.total, 4);
    assert.equal(summary.covered, 2);
    assert.equal(summary.percent, 50);
  });

  // @req FOUND-16
  test("breaks the summary down by milestone", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([{ path: "a.test.ts", content: "// @req FOUND-01" }]);
    const summary = summarise(registry, tags);
    assert.deepEqual(summary.byMilestone.get("M1"), {
      total: 2,
      covered: 1,
      missing: ["FOUND-02"],
    });
    assert.deepEqual(summary.byMilestone.get("M2"), {
      total: 1,
      covered: 0,
      missing: ["DB-01"],
    });
  });

  // @req FOUND-16
  test("reports zero percent for an untested registry", () => {
    const summary = summarise(parseRegistry(REGISTRY), new Map());
    assert.equal(summary.covered, 0);
    assert.equal(summary.percent, 0);
  });
});
