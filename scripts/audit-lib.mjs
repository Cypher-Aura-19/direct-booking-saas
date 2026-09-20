/**
 * Pure functions behind the requirement auditor.
 *
 * Nothing here touches the filesystem. An auditor with a bug is worse than
 * no auditor, so the logic is kept string-in / value-out and fully tested.
 */

const MILESTONE_HEADING = /^##\s+(M\d+|Cross-cutting)\b/;
const ANY_HEADING = /^##\s+/;
const REGISTRY_ROW = /^\|\s*([A-Z0-9]+-\d+)\s*\|\s*(.+?)\s*\|\s*$/;
const TAG = /@req\s+([A-Z0-9]+-\d+)/g;

export function parseRegistry(markdown) {
  const rows = [];
  let milestone = null;

  for (const line of markdown.split(/\r?\n/)) {
    const milestoneMatch = line.match(MILESTONE_HEADING);
    if (milestoneMatch) {
      milestone = milestoneMatch[1];
      continue;
    }
    // Any other h2 ends the current milestone, so the Totals table and
    // any prose section cannot leak rows into the last-seen milestone.
    if (ANY_HEADING.test(line)) {
      milestone = null;
      continue;
    }
    if (!milestone) continue;

    const row = line.match(REGISTRY_ROW);
    if (row) {
      rows.push({ id: row[1], requirement: row[2], milestone });
    }
  }

  return rows;
}

export function scanTags(files) {
  const tags = new Map();

  for (const file of files) {
    for (const match of file.content.matchAll(TAG)) {
      const id = match[1];
      const paths = tags.get(id) ?? [];
      if (!paths.includes(file.path)) paths.push(file.path);
      tags.set(id, paths);
    }
  }

  return tags;
}

export function findUnknownTags(tags, registry) {
  const known = new Set(registry.map((row) => row.id));
  const unknown = [];

  for (const [id, paths] of tags) {
    if (known.has(id)) continue;
    for (const path of paths) unknown.push({ id, path });
  }

  return unknown;
}

export function summarise(registry, tags) {
  const byMilestone = new Map();

  for (const row of registry) {
    const entry = byMilestone.get(row.milestone) ?? {
      total: 0,
      covered: 0,
      missing: [],
    };
    entry.total += 1;
    if (tags.has(row.id)) entry.covered += 1;
    else entry.missing.push(row.id);
    byMilestone.set(row.milestone, entry);
  }

  const total = registry.length;
  const covered = registry.filter((row) => tags.has(row.id)).length;

  return {
    total,
    covered,
    percent: total === 0 ? 0 : Math.round((covered / total) * 100),
    byMilestone,
  };
}

/*
  Physical utilities break RTL. Each pattern requires a digit or bracket
  after the dash so that ordinary identifiers containing the same letters
  are not flagged.
*/
const PHYSICAL_PATTERNS = [
  [/\bp[lr]-(?:\d|\[)/, "use ps- or pe- instead of pl- / pr-"],
  [/\bm[lr]-(?:\d|\[)/, "use ms- or me- instead of ml- / mr-"],
  [/\bborder-[lr]-(?:\d|\[)/, "use border-s- or border-e-"],
  [/\btext-(?:left|right)\b/, "use text-start or text-end"],
  [/\bfloat-(?:left|right)\b/, "use float-start or float-end"],
  [/\b(?:left|right)-(?:\d|\[)/, "use start- or end-"],
  // Raw CSS, not just Tailwind utilities.
  [
    /\b(?:padding|margin|border)-(?:left|right)\s*:/,
    "use the -inline-start / -inline-end property",
  ],
  [/\btext-align\s*:\s*(?:left|right)\b/, "use text-align: start or end"],
];

const OPT_OUT = "audit-ignore-physical";

export function findPhysicalUtilities(files) {
  const violations = [];

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((text, index) => {
      if (text.includes(OPT_OUT)) return;
      for (const [pattern, fix] of PHYSICAL_PATTERNS) {
        if (pattern.test(text)) {
          violations.push({
            path: file.path,
            line: index + 1,
            snippet: text.trim(),
            fix,
          });
          return;
        }
      }
    });
  }

  return violations;
}

// Skips leading whitespace and full comments — both "// ..." line comments
// and "/* ... */" block comments, however the block is formatted
// internally (with or without a leading "*" on continuation lines) — and
// returns the line that follows. A per-line prefix filter alone is not
// enough: a block comment whose continuation lines do not start with "*"
// (a common, legitimate style) would otherwise leave one of its inner
// lines mistaken for the file's first real statement.
function leadingStatement(content) {
  let i = 0;
  for (;;) {
    while (i < content.length && /\s/.test(content[i])) i++;
    if (content.startsWith("//", i)) {
      const nl = content.indexOf("\n", i);
      i = nl === -1 ? content.length : nl + 1;
      continue;
    }
    if (content.startsWith("/*", i)) {
      const end = content.indexOf("*/", i + 2);
      i = end === -1 ? content.length : end + 2;
      continue;
    }
    break;
  }
  return content.slice(i).split(/\r?\n/)[0].trim();
}

export function findServiceRoleLeaks(files) {
  const leaks = [];

  for (const file of files) {
    if (file.content.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE")) {
      leaks.push({
        path: file.path,
        reason: "service-role key exposed through a NEXT_PUBLIC_ variable",
      });
      continue;
    }

    // The "use client" directive must be the first statement in the file.
    // A whole-file substring search would misclassify a server-only file
    // that merely mentions the phrase in a comment, e.g.
    // "do not add 'use client' here".
    const isClient = /^["']use client["'];?$/.test(leadingStatement(file.content));

    if (isClient && file.content.includes("SERVICE_ROLE")) {
      leaks.push({
        path: file.path,
        reason: "service-role key referenced inside a client component",
      });
    }
  }

  return leaks;
}

export function renderTracker(registry, tags, summary) {
  const lines = [
    "# Phase 1 Tracker",
    "",
    "**This file is generated by `npm run audit`. Do not edit it by hand.**",
    "",
    "A requirement is done when a passing test carries its `@req` tag.",
    "Status is computed, never asserted.",
    "",
    `**Overall: ${summary.covered} of ${summary.total} requirements covered (${summary.percent}%)**`,
    "",
    "## By milestone",
    "",
    "| Milestone | Covered | Total |",
    "|---|---|---|",
  ];

  for (const [milestone, entry] of summary.byMilestone) {
    lines.push(`| ${milestone} | ${entry.covered} | ${entry.total} |`);
  }

  lines.push("", "## Requirements", "", "| ID | Milestone | Status | Proof |", "|---|---|---|---|");

  for (const row of registry) {
    const proof = tags.get(row.id);
    const status = proof ? "done" : "todo";
    lines.push(
      `| ${row.id} | ${row.milestone} | ${status} | ${proof ? proof.join(", ") : "—"} |`,
    );
  }

  return lines.join("\n") + "\n";
}
