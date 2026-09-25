// @vitest-environment node
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function routeFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return routeFiles(path.join(dir, entry.name), rel);
    return /^(page|route)\.(tsx|ts)$/.test(entry.name) ? [rel] : [];
  });
}

// @req PUB-09
it("no route lists or searches properties across organisations", () => {
  expect(existsSync(path.join(appDir, "s", "page.tsx"))).toBe(false);
  const publicRoutes = routeFiles(path.join(appDir, "s"), "/s");
  expect(publicRoutes.sort()).toEqual(["/s/[org]/[property]/page.tsx", "/s/[org]/page.tsx"]);
  const all = routeFiles(appDir);
  expect(all.filter((r) => /search|explore|browse|discover|listings/i.test(r))).toEqual([]);
});
