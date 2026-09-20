// Phase 3 browser verification with deterministic dashboard and analytics fixtures.
import fs from "node:fs/promises";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3002";
const output = path.resolve(process.env.UI_EVIDENCE_DIR || "docs/ui-ux/evidence/phase-3");
const browser = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir(output, { recursive: true });

const today = new Date();
today.setHours(12, 0, 0, 0);
const dateKey = (offset) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const populated = {
  profile: { user: { id: "phase3-user", email: "phase3@example.invalid", username: "phase3", name: "Phase Three", avatar_url: null } },
  stats: { problemsAttempted: 18, problemsSolved: 12, interviewsStarted: 4, bestStreak: 6, submissionsCount: 31, acceptanceRate: 55 },
  activity: { currentStreak: 2, bestStreak: 6, activityMap: { [dateKey(0)]: 2, [dateKey(-1)]: 1, [dateKey(-8)]: 4 } },
  recommendations: {
    recommended: [
      { id: "two-sum", slug: "two-sum", title: "Two Sum", difficulty: "easy", topics: ["Arrays", "Hash Map"] },
      { id: "merge-intervals", slug: "merge-intervals", title: "Merge Intervals", difficulty: "medium", topics: ["Arrays", "Sorting"] },
    ],
    revisit: [{ id: "valid-parentheses", slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "easy", topics: ["Stack"], lastAttemptedAt: `${dateKey(-5)}T12:00:00.000Z` }],
    focusAreas: ["Arrays", "Communication"],
    reasoning: "Your recent attempts suggest reinforcing array patterns before moving to a harder interval problem.",
    difficultySuggestion: "Medium",
  },
  analytics: {
    solvedOverTime: [
      { day: `${dateKey(-28)}T00:00:00.000Z`, count: 1 },
      { day: `${dateKey(-14)}T00:00:00.000Z`, count: 2 },
      { day: `${dateKey(-2)}T00:00:00.000Z`, count: 3 },
    ],
    difficultyDistribution: { easy: 5, medium: 4, hard: 1 },
    topicStrengths: [
      { topic: "Arrays", count: 6 },
      { topic: "Hash Map", count: 4 },
      { topic: "Trees", count: 3 },
      { topic: "Graphs", count: 2 },
    ],
    acceptanceTrend: [
      { week: `${dateKey(-21)}T00:00:00.000Z`, rate: 42 },
      { week: `${dateKey(-14)}T00:00:00.000Z`, rate: 60 },
      { week: `${dateKey(-7)}T00:00:00.000Z`, rate: 67 },
    ],
  },
};

const empty = {
  ...populated,
  stats: { problemsAttempted: 0, problemsSolved: 0, interviewsStarted: 0, bestStreak: 0, submissionsCount: 0, acceptanceRate: 0 },
  activity: { currentStreak: 0, bestStreak: 0, activityMap: {} },
  recommendations: { recommended: [], revisit: [], focusAreas: [], reasoning: "", difficultySuggestion: "" },
  analytics: { solvedOverTime: [], difficultyDistribution: {}, topicStrengths: [], acceptanceTrend: [] },
};

const report = {
  base,
  browser: browser.version(),
  observations: [],
  screenshots: [],
  consoleErrors: [],
  expectedConsoleErrors: [],
  pageErrors: [],
  notes: [
    "All dashboard and analytics API responses are deterministic browser fixtures; no paid AI routes were called.",
    "The 720 CSS-pixel viewport represents the reflow space of a 1440-pixel window at 200% zoom.",
    "Failure fixtures return one deliberate 503 before a local retry where the scenario requires recovery.",
  ],
};

async function contextFor({ theme = "dark", width = 1440, mode = "populated", reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion,
    storageState: {
      cookies: [],
      origins: [{ origin: new URL(base).origin, localStorage: [{ name: "if-theme", value: theme }, { name: "if-token", value: "phase3-fixture-token" }] }],
    },
  });
  const counts = { profile: 0, stats: 0, activity: 0, recommendations: 0, analytics: 0 };
  const fixture = mode === "empty" ? empty : populated;
  await context.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (pathname.endsWith("/users/me")) {
      counts.profile += 1;
      return respond(fixture.profile);
    }
    if (pathname.endsWith("/users/stats")) {
      counts.stats += 1;
      if (mode === "stats-retry" && counts.stats === 1) return respond({ error: "Statistics fixture unavailable" }, 503);
      return respond(fixture.stats);
    }
    if (pathname.endsWith("/users/activity")) {
      counts.activity += 1;
      if (mode === "activity-error") return respond({ error: "Activity fixture unavailable" }, 503);
      return respond(fixture.activity);
    }
    if (pathname.endsWith("/recommendations")) {
      counts.recommendations += 1;
      if (mode === "recommendations-retry" && counts.recommendations === 1) return respond({ error: "Suggestions fixture unavailable" }, 503);
      return respond(fixture.recommendations);
    }
    if (pathname.endsWith("/users/analytics")) {
      counts.analytics += 1;
      if (mode === "analytics-retry" && counts.analytics === 1) return respond({ error: "Analytics fixture unavailable" }, 503);
      return respond(fixture.analytics);
    }
    return respond({ error: `Unhandled fixture: ${pathname}` }, 501);
  });
  return { context, counts };
}

function observePage(page, label, expectedFailure = false) {
  page.on("pageerror", (error) => report.pageErrors.push({ label, message: error.message }));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const item = { label, message: message.text() };
    if (expectedFailure && /Failed to load resource/.test(item.message)) report.expectedConsoleErrors.push(item);
    else report.consoleErrors.push(item);
  });
}

async function observeLayout(page, label, route, theme) {
  const observation = await page.evaluate(() => {
    const viewportWidth = innerWidth;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const clippedControls = [...document.querySelectorAll("a, button, input, summary")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const locallyScrollable = element.closest("[data-heatmap-scroll]");
      return !locallyScrollable && visible(element) && rect.top < innerHeight && rect.bottom > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
    }).map((element) => ({ tag: element.tagName, text: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 90) }));
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      clippedControls,
      nestedInteractive: document.querySelectorAll("a button, button a, summary button, button summary").length,
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      bodyText: document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 240) || "",
    };
  });
  report.observations.push({ label, route, theme, ...observation });
  return observation;
}

async function visit({ route, label, theme, width, mode = "populated", screenshot = false, expectedFailure = false, reducedMotion = "no-preference" }) {
  const { context, counts } = await contextFor({ theme, width, mode, reducedMotion });
  const page = await context.newPage();
  observePage(page, label, expectedFailure);
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await page.locator("h1").waitFor();
  // Recharts uses JavaScript animation; wait for its 400ms delay + 1500ms duration.
  await page.waitForTimeout(2100);
  const observation = await observeLayout(page, label, route, theme);
  if (screenshot) {
    const filename = `${label}.png`;
    await page.screenshot({ path: path.join(output, filename), fullPage: true, animations: "disabled" });
    report.screenshots.push(filename);
  }
  await context.close();
  return { observation, counts };
}

try {
  for (const route of ["/dashboard", "/analytics"]) {
    const name = route.slice(1);
    for (const theme of ["dark", "light"]) {
      for (const width of [320, 390, 720, 768, 1024, 1440]) {
        await visit({
          route,
          label: `${name}-populated-${theme}-${width}`,
          theme,
          width,
          screenshot: (width === 390 && theme === "dark") || width === 1440,
        });
      }
    }
  }

  await visit({ route: "/dashboard", label: "dashboard-empty-light-1440", theme: "light", width: 1440, mode: "empty", screenshot: true });
  await visit({ route: "/analytics", label: "analytics-empty-light-1440", theme: "light", width: 1440, mode: "empty", screenshot: true });
  await visit({ route: "/dashboard", label: "dashboard-activity-error-dark-1440", theme: "dark", width: 1440, mode: "activity-error", screenshot: true, expectedFailure: true });

  const statsScenario = await contextFor({ theme: "dark", width: 1024, mode: "stats-retry" });
  const statsPage = await statsScenario.context.newPage();
  observePage(statsPage, "dashboard-stats-retry", true);
  await statsPage.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  await statsPage.getByRole("button", { name: "Retry statistics" }).waitFor();
  const statsBefore = { ...statsScenario.counts };
  const failedStatText = await statsPage.getByText("Problems attempted").locator("..").textContent();
  await statsPage.getByRole("button", { name: "Retry statistics" }).click();
  await statsPage.getByText("18", { exact: true }).waitFor();
  report.dashboardStatsRetry = { failedStatText, before: statsBefore, after: { ...statsScenario.counts }, recoveredValue: await statsPage.getByText("18", { exact: true }).textContent() };
  await statsScenario.context.close();

  const recommendationScenario = await contextFor({ theme: "light", width: 1440, mode: "recommendations-retry" });
  const recommendationPage = await recommendationScenario.context.newPage();
  observePage(recommendationPage, "dashboard-recommendations-retry", true);
  await recommendationPage.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  await recommendationPage.getByText("Practice suggestions are unavailable").waitFor();
  const recommendationsBefore = { ...recommendationScenario.counts };
  await recommendationPage.getByRole("button", { name: "Retry suggestions" }).click();
  await recommendationPage.getByText("Two Sum", { exact: true }).waitFor();
  report.dashboardRecommendationsRetry = { before: recommendationsBefore, after: { ...recommendationScenario.counts }, recovered: true };
  await recommendationScenario.context.close();

  const analyticsScenario = await contextFor({ theme: "dark", width: 390, mode: "analytics-retry" });
  const analyticsPage = await analyticsScenario.context.newPage();
  observePage(analyticsPage, "analytics-error-retry", true);
  await analyticsPage.goto(`${base}/analytics`, { waitUntil: "networkidle" });
  await analyticsPage.getByText("Analytics are unavailable").waitFor();
  const analyticsBefore = { ...analyticsScenario.counts };
  const emptyMistakenlyShown = await analyticsPage.getByText("No coding progress yet").count();
  await analyticsPage.getByRole("button", { name: "Retry analytics" }).click();
  await analyticsPage.getByText("10", { exact: true }).waitFor();
  report.analyticsRetry = { before: analyticsBefore, after: { ...analyticsScenario.counts }, emptyMistakenlyShown, recoveredTotal: 10 };
  await analyticsScenario.context.close();

  const keyboardScenario = await contextFor({ theme: "dark", width: 1440, mode: "populated" });
  const keyboardPage = await keyboardScenario.context.newPage();
  observePage(keyboardPage, "dashboard-keyboard");
  await keyboardPage.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const todayCell = keyboardPage.locator('button[aria-label*="activities on"]').last();
  await todayCell.focus();
  const todayLabel = await todayCell.getAttribute("aria-label");
  await keyboardPage.keyboard.press("ArrowUp");
  const previousLabel = await keyboardPage.locator("button:focus").getAttribute("aria-label");
  const tooltipVisible = await keyboardPage.getByRole("tooltip").isVisible();
  report.heatmapKeyboard = { todayLabel, previousLabel, tooltipVisible };
  await keyboardScenario.context.close();

  const mobileHeatmapScenario = await contextFor({ theme: "dark", width: 390, mode: "populated" });
  const mobileHeatmapPage = await mobileHeatmapScenario.context.newPage();
  observePage(mobileHeatmapPage, "dashboard-mobile-heatmap");
  await mobileHeatmapPage.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const mobileScroller = mobileHeatmapPage.locator("[data-heatmap-scroll]");
  const mobileTodayCell = mobileHeatmapPage.locator('button[aria-label*="activities on"]').last();
  await mobileTodayCell.waitFor();
  const latestWeekVisible = await mobileHeatmapPage.evaluate(() => {
    const scroller = document.querySelector("[data-heatmap-scroll]");
    const todayButton = [...document.querySelectorAll('button[aria-label*="activities on"]')].at(-1);
    const weekdayLabels = document.querySelector("[data-heatmap-weekdays]");
    if (!(scroller instanceof HTMLElement) || !(todayButton instanceof HTMLElement) || !(weekdayLabels instanceof HTMLElement)) return null;
    const scrollerRect = scroller.getBoundingClientRect();
    const todayRect = todayButton.getBoundingClientRect();
    const weekdayRect = weekdayLabels.getBoundingClientRect();
    return {
      scrollLeft: scroller.scrollLeft,
      maxScrollLeft: scroller.scrollWidth - scroller.clientWidth,
      todayLeft: todayRect.left,
      todayRight: todayRect.right,
      scrollerLeft: scrollerRect.left,
      scrollerRight: scrollerRect.right,
      visible: todayRect.left >= scrollerRect.left && todayRect.right <= scrollerRect.right,
      weekdayLabelsVisible: weekdayRect.left >= scrollerRect.left && weekdayRect.right <= scrollerRect.right,
    };
  });
  await mobileTodayCell.scrollIntoViewIfNeeded();
  await mobileTodayCell.dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true });
  const mobileTooltip = mobileHeatmapPage.getByRole("tooltip");
  await mobileTooltip.waitFor();
  const tooltipBox = await mobileTooltip.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const tooltipInViewport = tooltipBox.x >= 0 && tooltipBox.x + tooltipBox.width <= 390 && tooltipBox.y >= 0 && tooltipBox.y + tooltipBox.height <= 900;
  report.heatmapMobile = { latestWeekVisible, tooltipInViewport, tooltipBox, scrollerCount: await mobileScroller.count() };
  if (!latestWeekVisible?.visible || !latestWeekVisible.weekdayLabelsVisible || latestWeekVisible.scrollLeft < latestWeekVisible.maxScrollLeft - 1 || !tooltipInViewport) {
    throw new Error(`Mobile heatmap verification failed: ${JSON.stringify(report.heatmapMobile)}`);
  }
  await mobileHeatmapScenario.context.close();

  const dataScenario = await contextFor({ theme: "light", width: 1024, mode: "populated" });
  const dataPage = await dataScenario.context.newPage();
  observePage(dataPage, "analytics-data-tables");
  await dataPage.goto(`${base}/analytics`, { waitUntil: "networkidle" });
  await dataPage.getByText("Unique problems solved").waitFor();
  const summaries = await dataPage.locator("details summary").all();
  for (const summary of summaries) await summary.click();
  report.analyticsData = {
    summaryText: (await dataPage.getByRole("region", { name: "Analytics summary" }).textContent())?.replace(/\s+/g, " ").trim(),
    dataTables: await dataPage.locator("table").count(),
    topicTableCaptions: await dataPage.locator("caption").filter({ hasText: "Problems solved by topic" }).count(),
  };
  await dataScenario.context.close();

  const reduced = await contextFor({ theme: "dark", width: 1024, mode: "populated", reducedMotion: "reduce" });
  const reducedPage = await reduced.context.newPage();
  observePage(reducedPage, "dashboard-reduced-motion");
  await reducedPage.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  report.reducedMotion = await reducedPage.evaluate(() => ({
    preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
    activeInfinite: document.getAnimations().filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity).length,
  }));
  await reduced.context.close();

  const reducedAnalytics = await contextFor({ theme: "dark", width: 1024, mode: "populated", reducedMotion: "reduce" });
  const reducedAnalyticsPage = await reducedAnalytics.context.newPage();
  observePage(reducedAnalyticsPage, "analytics-reduced-motion");
  await reducedAnalyticsPage.goto(`${base}/analytics`, { waitUntil: "networkidle" });
  const sector = reducedAnalyticsPage.locator(".recharts-sector").first();
  await sector.waitFor();
  const sectorBefore = await sector.getAttribute("d");
  await reducedAnalyticsPage.waitForTimeout(150);
  const sectorAfter = await sector.getAttribute("d");
  report.reducedMotion.analyticsChartStatic = sectorBefore === sectorAfter;
  await reducedAnalytics.context.close();

  await fs.writeFile(path.join(output, "browser-phase3.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
