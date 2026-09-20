// Compare Phase 4 production routes with the Phase 3 checkpoint on the same machine.
import fs from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = process.env.PROD_EVIDENCE || "docs/ui-ux/evidence/phase-4/production-final.json";
const targets = [
  { name: "phase4", base: process.env.PHASE4_URL || "http://localhost:3003" },
  { name: "phase3-control", base: process.env.PHASE3_URL || "http://localhost:3004" },
];
if (process.env.PROD_REVERSE === "1") targets.reverse();
const browser = await chromium.launch({ channel: "chrome", headless: true });

const difficulties = ["easy", "medium", "hard"];
const topics = ["Arrays", "Graphs", "Trees", "Dynamic Programming"];
const problems = Array.from({ length: 150 }, (_, index) => ({
  id: `problem-${String(index + 1).padStart(3, "0")}`,
  slug: `problem-${index + 1}`,
  title: `Practice Problem ${index + 1}`,
  description: `Production comparison problem ${index + 1}`,
  difficulty: difficulties[index % difficulties.length],
  topics: [topics[index % topics.length]],
  companies: [index % 2 === 0 ? "Amazon" : "Meta"],
  is_solved: index % 3 === 0,
  is_bookmarked: index % 10 === 0,
}));

const paths = [
  { id: "array-foundations", slug: "array-foundations", title: "Array Foundations", description: "Build array techniques.", topic: "Arrays", difficultyLevel: "beginner", problemCount: 4, completedCount: 2 },
  { id: "graph-patterns", slug: "graph-patterns", title: "Graph Patterns", description: "Build graph techniques.", topic: "Graphs", difficultyLevel: "intermediate", problemCount: 6, completedCount: 1 },
];

const detail = {
  path: { ...paths[0] },
  problems: [
    { problemId: "problem-001", position: 0, title: "Two Sum", slug: "two-sum", difficulty: "easy", isCompleted: true },
    { problemId: "problem-002", position: 1, title: "Best Time to Buy and Sell Stock", slug: "stock", difficulty: "easy", isCompleted: true },
    { problemId: "problem-003", position: 2, title: "Longest Consecutive Sequence", slug: "longest", difficulty: "medium", isCompleted: false },
    { problemId: "problem-004", position: 3, title: "Product of Array Except Self", slug: "product", difficulty: "medium", isCompleted: false },
  ],
};

const report = {
  browser: browser.version(),
  method: "Five local unthrottled navigations per route and build; deterministic 150-problem and path fixtures; first sample is cold within its browser context.",
  builds: {},
  comparison: {},
  note: "Local directional evidence, not field Web Vitals.",
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};
const percent = (current, control) => control === 0 ? null : Number((((current - control) / control) * 100).toFixed(1));

async function measure(target, route) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [{ origin: target.base, localStorage: [{ name: "if-theme", value: "dark" }, { name: "if-token", value: "phase4-production-token" }] }] },
  });
  await context.route("**/api/**", (routeHandle) => {
    const pathname = new URL(routeHandle.request().url()).pathname;
    let body;
    if (pathname === "/api/users/me") body = { user: { id: "perf", email: "perf@example.invalid", username: "perf", name: "Performance Fixture", avatar_url: null } };
    else if (pathname === "/api/problems") body = { problems };
    else if (pathname === "/api/learning-paths") body = { paths };
    else if (pathname === "/api/learning-paths/array-foundations") body = detail;
    else body = { error: `Unhandled fixture: ${pathname}` };
    return routeHandle.fulfill({ status: body.error ? 501 : 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await context.addInitScript(() => {
    window.__phase4Shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__phase4Shifts.push(entry.value);
    }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await context.newPage();
  const samples = [];
  try {
    for (let index = 0; index < 5; index += 1) {
      await page.goto(`${target.base}${route}`, { waitUntil: "load" });
      if (route === "/problems") await page.locator('a[href="/problems/problem-001"]').waitFor();
      else if (route === "/paths") await page.locator('a[href="/paths/array-foundations"]').waitFor();
      else await page.getByRole("heading", { name: "Array Foundations" }).waitFor();
      const readyMs = await page.evaluate(() => performance.now());
      await page.waitForTimeout(100);
      samples.push(await page.evaluate((ready) => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const scripts = performance.getEntriesByType("resource").filter((resource) => resource.initiatorType === "script");
        return {
          responseStartMs: navigation.responseStart,
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          loadMs: navigation.loadEventEnd,
          readyMs: ready,
          readyAfterResponseMs: ready - navigation.responseStart,
          layoutShiftSum: window.__phase4Shifts.reduce((sum, value) => sum + value, 0),
          scriptCount: scripts.length,
          scriptDecodedBytes: scripts.reduce((sum, resource) => sum + resource.decodedBodySize, 0),
        };
      }, readyMs));
    }
  } finally {
    await context.close();
  }
  return {
    samples,
    medians: {
      responseStartMs: median(samples.map((sample) => sample.responseStartMs)),
      domContentLoadedMs: median(samples.map((sample) => sample.domContentLoadedMs)),
      loadMs: median(samples.map((sample) => sample.loadMs)),
      readyMs: median(samples.map((sample) => sample.readyMs)),
      readyAfterResponseMs: median(samples.map((sample) => sample.readyAfterResponseMs)),
      layoutShiftSum: median(samples.map((sample) => sample.layoutShiftSum)),
      scriptCount: median(samples.map((sample) => sample.scriptCount)),
      scriptDecodedBytes: median(samples.map((sample) => sample.scriptDecodedBytes)),
    },
  };
}

try {
  for (const target of targets) {
    report.builds[target.name] = {};
    for (const route of ["/problems", "/paths", "/paths/array-foundations"]) {
      report.builds[target.name][route] = await measure(target, route);
    }
  }

  for (const route of ["/problems", "/paths", "/paths/array-foundations"]) {
    const current = report.builds.phase4[route].medians;
    const control = report.builds["phase3-control"][route].medians;
    report.comparison[route] = {
      readyAfterResponsePercent: percent(current.readyAfterResponseMs, control.readyAfterResponseMs),
      loadPercent: percent(current.loadMs, control.loadMs),
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
