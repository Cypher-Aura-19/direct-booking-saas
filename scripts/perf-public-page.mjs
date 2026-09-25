// Manual budget check for PERF-01 / M5 "done when": a public property page
// must render within 3s on a throttled slow-3G profile. Not run in CI (no
// seeded data there).
// Usage: node scripts/perf-public-page.mjs http://localhost:3002/s/<org>/<property>
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
const { chromium } = require(`${globalRoot}/playwright`);

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/perf-public-page.mjs <public page url>");
  process.exit(2);
}

// Chrome DevTools' "Slow 3G": 400 ms RTT, ~400 kbit/s both ways.
const SLOW_3G = { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 };
const BUDGET_MS = 3000;

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const page = await context.newPage();
// Warm the server (first dev-mode compile is not what a guest pays).
await page.goto(url, { waitUntil: "load" });
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.clearBrowserCache");
await cdp.send("Network.emulateNetworkConditions", SLOW_3G);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await page.goto(url, { waitUntil: "load", timeout: 60_000 });
const timing = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const lcp = performance.getEntriesByType("largest-contentful-paint").at(-1);
  return { load: Math.round(nav.loadEventEnd), fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0), lcp: Math.round(lcp?.startTime ?? 0) };
});
await browser.close();

console.log(`FCP ${timing.fcp} ms · LCP ${timing.lcp || "n/a"} ms · load ${timing.load} ms (budget ${BUDGET_MS} ms, render = FCP)`);
if (timing.fcp > BUDGET_MS) {
  console.error("Over budget: the page does not render within 3 s on slow 3G.");
  process.exit(1);
}
