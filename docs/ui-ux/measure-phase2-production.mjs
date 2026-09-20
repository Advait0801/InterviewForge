// Measures the Phase 2 production homepage using the same three-navigation shape as Phase 0.
import fs from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = process.env.PROD_URL || "http://localhost:3003";
const output = process.env.PROD_EVIDENCE || "docs/ui-ux/evidence/phase-2/production-home.json";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const report = {
  url,
  route: "/",
  browser: browser.version(),
  cache: "one cold then two warm navigations in the same context",
  samples: [],
  note: "Local unthrottled navigation evidence; compare directionally with Phase 0, not as field Web Vitals.",
};

await page.addInitScript(() => {
  window.__phase2ProductionShifts = [];
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) window.__phase2ProductionShifts.push(entry.value);
    }
  }).observe({ type: "layout-shift", buffered: true });
});

try {
  for (let index = 0; index < 3; index += 1) {
    await page.goto(url, { waitUntil: "networkidle" });
    report.samples.push(await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const scripts = performance.getEntriesByType("resource").filter((resource) => resource.initiatorType === "script");
      return {
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadMs: navigation.loadEventEnd,
        observedLayoutShiftSum: window.__phase2ProductionShifts.reduce((sum, value) => sum + value, 0),
        scriptCount: scripts.length,
        scriptDecodedBytes: scripts.reduce((sum, resource) => sum + resource.decodedBodySize, 0),
      };
    }));
  }
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
