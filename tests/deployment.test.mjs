import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (name) =>
  readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");

const vercel = JSON.parse(read("vercel.json"));
const rootPackage = JSON.parse(read("package.json"));

// @req FOUND-01
test("root workspace delegates application commands to web/", () => {
  assert.equal(rootPackage.scripts.dev, "npm run dev --prefix web");
  assert.equal(rootPackage.scripts.build, "npm run build --prefix web");
  assert.equal(rootPackage.scripts.lint, "npm run lint --prefix web");
});

// @req FOUND-01
test("root workspace owns the tooling commands itself", () => {
  assert.equal(rootPackage.scripts.audit, "node scripts/audit.mjs");
  assert.match(rootPackage.scripts["test:scripts"], /node --test/);
});

// @req FOUND-18
test("deployment builds the web app and targets Next.js", () => {
  assert.equal(vercel.buildCommand, "npm run build");
  assert.equal(vercel.outputDirectory, "web/.next");
  assert.equal(vercel.framework, "nextjs");
});
