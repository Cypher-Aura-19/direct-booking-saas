#!/usr/bin/env node
/**
 * Requirement auditor.
 *
 *   node scripts/audit.mjs                 hard checks + regenerate the tracker
 *   node scripts/audit.mjs --milestone M1  additionally require full coverage of M1
 *
 * Hard checks always fail the build. Coverage only fails the build when a
 * milestone is named, because early in a milestone most requirements are
 * legitimately untested.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRegistry,
  scanTags,
  findUnknownTags,
  findPhysicalUtilities,
  findServiceRoleLeaks,
  summarise,
  renderTracker,
} from "./audit-lib.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", ".vercel"]);

function walk(dir) {
  const out = [];
  let entries;
  try {
    // Sorted by code unit: readdirSync order differs between NTFS and
    // Linux filesystems, which made the generated tracker differ on CI.
    entries = readdirSync(dir).sort();
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function load(paths) {
  return paths.map((path) => ({
    path: relative(ROOT, path).replaceAll("\\", "/"),
    content: readFileSync(path, "utf8"),
  }));
}

const allFiles = walk(ROOT);
const testFiles = load(allFiles.filter((p) => /\.test\.(ts|tsx|mjs|js)$/.test(p)));
const sourceFiles = load(allFiles.filter((p) => /\.(ts|tsx|css)$/.test(p)));

const registry = parseRegistry(readFileSync(join(ROOT, "docs/requirements.md"), "utf8"));
const tags = scanTags(testFiles);
const summary = summarise(registry, tags);

const failures = [];

for (const { id, path } of findUnknownTags(tags, registry)) {
  failures.push(`${path}: @req ${id} is not in docs/requirements.md`);
}
for (const v of findPhysicalUtilities(sourceFiles)) {
  failures.push(`${v.path}:${v.line}: physical CSS utility — ${v.fix}\n    ${v.snippet}`);
}
for (const leak of findServiceRoleLeaks(sourceFiles)) {
  failures.push(`${leak.path}: ${leak.reason}`);
}

const milestoneFlag = process.argv.indexOf("--milestone");
if (milestoneFlag !== -1) {
  const name = process.argv[milestoneFlag + 1];
  const entry = summary.byMilestone.get(name);
  if (!entry) {
    failures.push(`unknown milestone: ${name}`);
  } else if (entry.missing.length > 0) {
    failures.push(
      `${name} is not complete — untested: ${entry.missing.join(", ")}`,
    );
  }
}

writeFileSync(join(ROOT, "docs/TRACKER.md"), renderTracker(registry, tags, summary));

console.log(
  `Requirements: ${summary.covered}/${summary.total} covered (${summary.percent}%)`,
);
console.log("Tracker written to docs/TRACKER.md");

if (failures.length > 0) {
  console.error(`\n${failures.length} audit failure(s):\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Audit passed.");
