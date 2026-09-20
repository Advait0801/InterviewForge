// Compare Phase 3 production routes with the Phase 2 commit on the same machine.
import fs from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = process.env.PROD_EVIDENCE || "docs/ui-ux/evidence/phase-3/production-comparison.json";
const targets = [
  { name: "phase3", base: process.env.PHASE3_URL || "http://localhost:3003" },
  { name: "phase2-control", base: process.env.PHASE2_URL || "http://localhost:3004" },
];
if (process.env.PROD_REVERSE === "1") targets.reverse();
const browser = await chromium.launch({ channel: "chrome", headless: true });

const fixtures = {
  "/api/users/me": { user: { id: "perf", email: "perf@example.invalid", username: "perf", name: "Performance Fixture", avatar_url: null } },
  "/api/users/stats": { problemsAttempted: 18, problemsSolved: 12, interviewsStarted: 4, bestStreak: 6, submissionsCount: 31, acceptanceRate: 55 },
  "/api/users/activity": { currentStreak: 2, bestStreak: 6, activityMap: { "2026-09-15": 2, "2026-09-14": 1 } },
  "/api/recommendations": { recommended: [], revisit: [], focusAreas: [], reasoning: "", difficultySuggestion: "" },
  "/api/users/analytics": {
    solvedOverTime: [{ day: "2026-09-01", count: 1 }, { day: "2026-09-14", count: 2 }],
    difficultyDistribution: { easy: 5, medium: 4, hard: 1 },
    topicStrengths: [{ topic: "Arrays", count: 6 }, { topic: "Trees", count: 3 }, { topic: "Graphs", count: 2 }],
    acceptanceTrend: [{ week: "2026-09-01", rate: 50 }, { week: "2026-09-08", rate: 67 }],
  },
};

const report = {
  browser: browser.version(),
  method: "Five local unthrottled navigations per route and build; first sample is cold within its browser context.",
  builds: {},
  comparison: {},
  note: "Local directional evidence, not field Web Vitals.",
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};
const percent = (current, control) => Number((((current - control) / control) * 100).toFixed(1));

async function measure(target, route) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [{ origin: target.base, localStorage: [{ name: "if-theme", value: "dark" }, { name: "if-token", value: "phase3-production-token" }] }] },
  });
  await context.route("**/api/**", (routeHandle) => {
    const pathname = new URL(routeHandle.request().url()).pathname;
    const body = fixtures[pathname] ?? { error: `Unhandled fixture: ${pathname}` };
    return routeHandle.fulfill({ status: fixtures[pathname] ? 200 : 501, contentType: "application/json", body: JSON.stringify(body) });
  });
  await context.addInitScript(() => {
    window.__phase3Shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__phase3Shifts.push(entry.value);
    }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await context.newPage();
  const samples = [];
  try {
    for (let index = 0; index < 5; index += 1) {
      await page.goto(`${target.base}${route}`, { waitUntil: "networkidle" });
      await page.locator("h1").waitFor();
      await page.waitForTimeout(150);
      samples.push(await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const scripts = performance.getEntriesByType("resource").filter((resource) => resource.initiatorType === "script");
        return {
          responseStartMs: navigation.responseStart,
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          domContentLoadedAfterResponseMs: navigation.domContentLoadedEventEnd - navigation.responseStart,
          loadMs: navigation.loadEventEnd,
          loadAfterResponseMs: navigation.loadEventEnd - navigation.responseStart,
          layoutShiftSum: window.__phase3Shifts.reduce((sum, value) => sum + value, 0),
          scriptCount: scripts.length,
          scriptDecodedBytes: scripts.reduce((sum, resource) => sum + resource.decodedBodySize, 0),
        };
      }));
    }
  } finally {
    await context.close();
  }
  return {
    samples,
    medians: {
      responseStartMs: median(samples.map((sample) => sample.responseStartMs)),
      domContentLoadedMs: median(samples.map((sample) => sample.domContentLoadedMs)),
      domContentLoadedAfterResponseMs: median(samples.map((sample) => sample.domContentLoadedAfterResponseMs)),
      loadMs: median(samples.map((sample) => sample.loadMs)),
      loadAfterResponseMs: median(samples.map((sample) => sample.loadAfterResponseMs)),
      layoutShiftSum: median(samples.map((sample) => sample.layoutShiftSum)),
      scriptCount: median(samples.map((sample) => sample.scriptCount)),
      scriptDecodedBytes: median(samples.map((sample) => sample.scriptDecodedBytes)),
    },
  };
}

try {
  for (const target of targets) {
    report.builds[target.name] = {};
    for (const route of ["/dashboard", "/analytics"]) {
      report.builds[target.name][route] = await measure(target, route);
    }
  }

  for (const route of ["/dashboard", "/analytics"]) {
    const current = report.builds.phase3[route].medians;
    const control = report.builds["phase2-control"][route].medians;
    report.comparison[route] = {
      responseStartPercent: percent(current.responseStartMs, control.responseStartMs),
      domContentLoadedPercent: percent(current.domContentLoadedMs, control.domContentLoadedMs),
      domContentLoadedAfterResponsePercent: percent(current.domContentLoadedAfterResponseMs, control.domContentLoadedAfterResponseMs),
      loadPercent: percent(current.loadMs, control.loadMs),
      loadAfterResponsePercent: percent(current.loadAfterResponseMs, control.loadAfterResponseMs),
      scriptDecodedBytesPercent: percent(current.scriptDecodedBytes, control.scriptDecodedBytes),
      scriptCountDelta: current.scriptCount - control.scriptCount,
      layoutShiftDelta: Number((current.layoutShiftSum - control.layoutShiftSum).toFixed(6)),
    };
  }

  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
