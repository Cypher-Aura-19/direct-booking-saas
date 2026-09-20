import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseRegistry,
  scanTags,
  findUnknownTags,
  summarise,
  findPhysicalUtilities,
  findServiceRoleLeaks,
  renderTracker,
} from "./audit-lib.mjs";

// This file is itself scanned by the real auditor (it carries the @req
// tags that prove FOUND-12..FOUND-16). Fixture content below feeds fake
// "@req ID" strings into scanTags/findUnknownTags to test the library in
// isolation. Built via concatenation, not written as a literal "@req"
// substring, so those fixtures are not mistaken by the real auditor run
// for genuine proof tags or genuine unknown-tag violations.
const TAG_MARK = "@" + "req";

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
      { path: "a.test.ts", content: `// ${TAG_MARK} FOUND-01\nit('works', ...)` },
    ]);
    assert.deepEqual(tags.get("FOUND-01"), ["a.test.ts"]);
  });

  // @req FOUND-13
  test("records every file that tags the same requirement", () => {
    const tags = scanTags([
      { path: "a.test.ts", content: `// ${TAG_MARK} FOUND-01` },
      { path: "b.test.ts", content: `// ${TAG_MARK} FOUND-01` },
    ]);
    assert.deepEqual(tags.get("FOUND-01"), ["a.test.ts", "b.test.ts"]);
  });

  // @req FOUND-13
  test("finds several tags in one file", () => {
    const tags = scanTags([
      { path: "a.test.ts", content: `// ${TAG_MARK} FOUND-01\n// ${TAG_MARK} DB-01` },
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
      { path: "a.test.ts", content: `// ${TAG_MARK} FOUND-99` },
    ]);
    assert.deepEqual(findUnknownTags(tags, registry), [
      { id: "FOUND-99", path: "a.test.ts" },
    ]);
  });

  // @req FOUND-12
  test("accepts a tag that exists", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([
      { path: "a.test.ts", content: `// ${TAG_MARK} FOUND-01` },
    ]);
    assert.deepEqual(findUnknownTags(tags, registry), []);
  });
});

describe("summarise", () => {
  // @req FOUND-16
  test("counts covered requirements and a percentage", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([
      { path: "a.test.ts", content: `// ${TAG_MARK} FOUND-01\n// ${TAG_MARK} DB-01` },
    ]);
    const summary = summarise(registry, tags);
    assert.equal(summary.total, 4);
    assert.equal(summary.covered, 2);
    assert.equal(summary.percent, 50);
  });

  // @req FOUND-16
  test("breaks the summary down by milestone", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([{ path: "a.test.ts", content: `// ${TAG_MARK} FOUND-01` }]);
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

describe("findPhysicalUtilities", () => {
  // @req FOUND-14
  test("flags physical padding", () => {
    const found = findPhysicalUtilities([
      { path: "a.tsx", content: '<div className="pl-4" />' },
    ]);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, "a.tsx");
    assert.match(found[0].fix, /ps-/);
  });

  // @req FOUND-14
  test("flags physical margin", () => {
    const found = findPhysicalUtilities([
      { path: "a.tsx", content: '<div className="mr-2" />' },
    ]);
    assert.equal(found.length, 1);
  });

  // @req FOUND-14
  test("flags text-left and text-right", () => {
    const found = findPhysicalUtilities([
      { path: "a.tsx", content: '<p className="text-left" />' },
      { path: "b.tsx", content: '<p className="text-right" />' },
    ]);
    assert.equal(found.length, 2);
  });

  // @req FOUND-14
  test("accepts logical equivalents", () => {
    const found = findPhysicalUtilities([
      {
        path: "a.tsx",
        content: '<div className="ps-4 me-2 text-start border-s-2" />',
      },
    ]);
    assert.deepEqual(found, []);
  });

  // @req FOUND-14
  test("does not flag unrelated words containing the same letters", () => {
    const found = findPhysicalUtilities([
      { path: "a.tsx", content: "const html_parser = 1; // sample-2" },
    ]);
    assert.deepEqual(found, []);
  });

  // @req FOUND-14
  test("flags raw physical CSS properties, not only Tailwind utilities", () => {
    const found = findPhysicalUtilities([
      { path: "a.css", content: ".x { padding-left: 4px; }" },
      { path: "b.css", content: ".y { margin-right: 4px; }" },
      { path: "c.css", content: ".z { text-align: left; }" },
      { path: "d.css", content: ".w { border-right: 1px solid red; }" },
    ]);
    assert.equal(found.length, 4);
  });

  // @req FOUND-14
  test("accepts raw logical CSS properties", () => {
    const found = findPhysicalUtilities([
      {
        path: "a.css",
        content: ".x { padding-inline-start: 4px; text-align: start; }",
      },
    ]);
    assert.deepEqual(found, []);
  });

  // @req FOUND-14
  test("honours an explicit opt-out comment", () => {
    const found = findPhysicalUtilities([
      { path: "a.tsx", content: '<div className="pl-4" /> // audit-ignore-physical' },
    ]);
    assert.deepEqual(found, []);
  });

  // @req FOUND-14
  test("reports the line number", () => {
    const found = findPhysicalUtilities([
      { path: "a.tsx", content: 'ok\nok\n<div className="pl-4" />' },
    ]);
    assert.equal(found[0].line, 3);
  });
});

describe("findServiceRoleLeaks", () => {
  // @req FOUND-15
  test("flags the service-role key in a client component", () => {
    const found = findServiceRoleLeaks([
      {
        path: "a.tsx",
        content: '"use client";\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY;',
      },
    ]);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, "a.tsx");
  });

  // @req FOUND-15
  test("flags a NEXT_PUBLIC service-role variable anywhere", () => {
    const found = findServiceRoleLeaks([
      { path: "a.ts", content: "process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" },
    ]);
    assert.equal(found.length, 1);
  });

  // @req FOUND-15
  test("allows the service-role key in a server-only module", () => {
    const found = findServiceRoleLeaks([
      { path: "a.ts", content: "const k = process.env.SUPABASE_SERVICE_ROLE_KEY;" },
    ]);
    assert.deepEqual(found, []);
  });

  // @req FOUND-15
  test("allows a client component with no service-role reference", () => {
    const found = findServiceRoleLeaks([
      { path: "a.tsx", content: '"use client";\nexport default function C() {}' },
    ]);
    assert.deepEqual(found, []);
  });

  // @req FOUND-15
  test("allows a server-only module that merely mentions the phrase in a comment", () => {
    const found = findServiceRoleLeaks([
      {
        path: "a.ts",
        content:
          '// do not add "use client" here — this reads the service role key\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY;',
      },
    ]);
    assert.deepEqual(found, []);
  });

  // @req FOUND-15
  test("recognises the directive with leading blank lines and comments", () => {
    const found = findServiceRoleLeaks([
      {
        path: "a.tsx",
        content:
          '\n// eslint-disable-next-line\n"use client";\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY;',
      },
    ]);
    assert.equal(found.length, 1);
  });

  // @req FOUND-15
  test("still detects a real leak behind a leading block comment header", () => {
    const found = findServiceRoleLeaks([
      {
        path: "a.tsx",
        content:
          '/**\n * License header\n */\n"use client";\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY;',
      },
    ]);
    assert.equal(found.length, 1);
  });

  // @req FOUND-15
  test("still detects a real leak behind a block comment with no leading star on continuation lines", () => {
    const found = findServiceRoleLeaks([
      {
        path: "a.tsx",
        content:
          '/*\nLicense header\nno star on this line\n*/\n"use client";\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY;',
      },
    ]);
    assert.equal(found.length, 1);
  });
});

describe("renderTracker", () => {
  // @req FOUND-16
  test("writes a row per requirement with its proof", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([{ path: "a.test.ts", content: `// ${TAG_MARK} FOUND-01` }]);
    const markdown = renderTracker(registry, tags, summarise(registry, tags));
    assert.match(markdown, /FOUND-01/);
    assert.match(markdown, /a\.test\.ts/);
  });

  // @req FOUND-16
  test("shows an untested requirement as not done", () => {
    const registry = parseRegistry(REGISTRY);
    const markdown = renderTracker(registry, new Map(), summarise(registry, new Map()));
    assert.match(markdown, /FOUND-02 \| M1 \| todo/);
  });

  // @req FOUND-16
  test("states the overall completion percentage", () => {
    const registry = parseRegistry(REGISTRY);
    const tags = scanTags([{ path: "a.test.ts", content: `// ${TAG_MARK} FOUND-01\n// ${TAG_MARK} DB-01` }]);
    const markdown = renderTracker(registry, tags, summarise(registry, tags));
    assert.match(markdown, /50%/);
  });

  // @req FOUND-16
  test("warns that the file is generated", () => {
    const registry = parseRegistry(REGISTRY);
    const markdown = renderTracker(registry, new Map(), summarise(registry, new Map()));
    assert.match(markdown, /generated/i);
  });
});
