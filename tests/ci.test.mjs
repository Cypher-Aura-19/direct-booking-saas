import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workflow = readFileSync(
  fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url)),
  "utf8",
);

// @req FOUND-17
test("CI runs lint, tests, the auditor and the build", () => {
  for (const command of [
    "npm run lint",
    "npm test",
    "npm run audit",
    "npm run build",
  ]) {
    assert.ok(
      workflow.includes(command),
      `expected CI to run \`${command}\``,
    );
  }
});

// @req FOUND-17
test("CI runs on push and on pull requests", () => {
  assert.match(workflow, /push:/);
  assert.match(workflow, /pull_request:/);
});

// @req FOUND-17
test("CI fails when the committed tracker is stale", () => {
  assert.match(workflow, /git diff --exit-code docs\/TRACKER\.md/);
});

// @req FOUND-05
test("CI proves design tokens compile to real utilities, not just that they are spelled right", () => {
  assert.match(workflow, /static\/chunks\/\*\.css/);
  for (const utility of ["bg-accent", "text-ink", "rounded-pill"]) {
    assert.ok(
      workflow.includes(utility),
      `expected CI to check the ${utility} utility compiles`,
    );
  }
});
