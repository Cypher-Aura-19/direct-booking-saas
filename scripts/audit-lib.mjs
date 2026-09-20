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
