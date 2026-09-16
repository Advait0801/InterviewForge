// Phase 4 browser verification with deterministic catalogue and learning-path fixtures.
import fs from "node:fs/promises";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3002";
const output = path.resolve(process.env.UI_EVIDENCE_DIR || "docs/ui-ux/evidence/phase-4");
const browser = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir(output, { recursive: true });

const difficulties = ["easy", "medium", "hard"];
const topics = ["Arrays", "Graphs", "Dynamic Programming", "Trees"];
const companies = ["Amazon", "Meta", "Google", "Apple"];
const problems = Array.from({ length: 150 }, (_, index) => ({
  id: `problem-${String(index + 1).padStart(3, "0")}`,
  slug: `problem-${index + 1}`,
  title: index === 24
    ? "Reconstruct the Lexicographically Smallest Valid Sequence Under Multiple Constraints"
    : `Practice Problem ${index + 1}`,
  description: `A deterministic practice challenge for ${topics[index % topics.length]} with enough detail to verify compact catalogue rows.`,
  difficulty: difficulties[index % difficulties.length],
  topics: [topics[index % topics.length], index % 2 === 0 ? "Hash Map" : "Sorting"],
  companies: [companies[index % companies.length]],
  is_solved: index % 3 === 0,
  is_bookmarked: index % 10 === 0,
}));
problems[149] = {
  ...problems[149],
  id: "sliding-graph-window",
  slug: "sliding-graph-window",
  title: "Sliding Graph Window",
  description: "A focused graph interview problem for the combined filter fixture.",
  difficulty: "medium",
  topics: ["Graphs", "Sliding Window"],
  companies: ["Meta"],
  is_solved: true,
  is_bookmarked: true,
};

const pathSummaries = [
  { id: "array-foundations", slug: "array-foundations", title: "Array Foundations", description: "Build a dependable base with traversal, lookup, and window patterns.", topic: "Arrays", difficultyLevel: "beginner", problemCount: 6, completedCount: 2 },
  { id: "graph-interviews", slug: "graph-interviews", title: "Graph Interview Patterns", description: "Move from traversal to shortest paths and dependency reasoning.", topic: "Graphs", difficultyLevel: "intermediate", problemCount: 8, completedCount: 3 },
  { id: "dynamic-programming", slug: "dynamic-programming", title: "Dynamic Programming Without Guesswork", description: "Learn to identify state, recurrence, and space optimizations.", topic: "Dynamic Programming", difficultyLevel: "advanced", problemCount: 7, completedCount: 0 },
];

const pathDetail = {
  path: { slug: "array-foundations", title: "Array Foundations", description: "Build a dependable base with traversal, lookup, and window patterns.", topic: "Arrays", difficultyLevel: "beginner", problemCount: 4, completedCount: 2 },
  problems: [
    { problemId: "problem-001", position: 0, title: "Two Sum", slug: "two-sum", difficulty: "easy", isCompleted: true },
    { problemId: "problem-002", position: 1, title: "Best Time to Buy and Sell Stock", slug: "stock", difficulty: "easy", isCompleted: true },
    { problemId: "problem-003", position: 2, title: "Longest Consecutive Sequence", slug: "longest", difficulty: "medium", isCompleted: false },
    { problemId: "problem-004", position: 3, title: "Product of Array Except Self", slug: "product", difficulty: "medium", isCompleted: false },
  ],
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
    "All catalogue and learning-path API responses are deterministic fixtures.",
    "The populated catalogue contains exactly 150 problems, including a long-title fixture.",
    "The 720 CSS-pixel viewport represents the reflow space of a 1440-pixel window at 200% zoom.",
  ],
};

async function contextFor({ theme = "dark", width = 1440, mode = "populated", reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion,
    storageState: {
      cookies: [],
      origins: [{ origin: new URL(base).origin, localStorage: [{ name: "if-theme", value: theme }, { name: "if-token", value: "phase4-fixture-token" }] }],
    },
  });
  const counts = { problems: 0, bookmarkAdds: 0, bookmarkRemoves: 0, paths: 0, pathDetail: 0 };
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (pathname === "/api/users/me") {
      return respond({ user: { id: "phase4-user", email: "phase4@example.invalid", username: "phase4", name: "Phase Four", avatar_url: null } });
    }
    if (pathname === "/api/problems") {
      counts.problems += 1;
      if (mode === "catalogue-error" || (mode === "catalogue-retry" && counts.problems === 1)) return respond({ error: "Catalogue fixture unavailable" }, 503);
      return respond({ problems: mode === "empty-catalogue" ? [] : problems });
    }
    if (pathname.startsWith("/api/problem-bookmarks/")) {
      if (request.method() === "POST") counts.bookmarkAdds += 1;
      if (request.method() === "DELETE") counts.bookmarkRemoves += 1;
      return respond({ ok: true });
    }
    if (pathname === "/api/learning-paths") {
      counts.paths += 1;
      if (mode === "paths-error" || (mode === "paths-retry" && counts.paths === 1)) return respond({ error: "Learning paths fixture unavailable" }, 503);
      return respond({ paths: mode === "empty-paths" ? [] : pathSummaries });
    }
    if (pathname.startsWith("/api/learning-paths/")) {
      counts.pathDetail += 1;
      if (mode === "detail-not-found") return respond({ error: "Learning path not found" }, 404);
      if (mode === "detail-error" || (mode === "detail-retry" && counts.pathDetail === 1)) return respond({ error: "Path detail fixture unavailable" }, 503);
      return respond(pathDetail);
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
    const clippedControls = [...document.querySelectorAll("a, button, input, select, summary")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return visible(element) && rect.top < innerHeight && rect.bottom > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
    }).map((element) => ({ tag: element.tagName, text: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 90) }));
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      clippedControls,
      nestedInteractive: document.querySelectorAll("a button, button a, summary button, button summary").length,
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      bodyText: document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 260) || "",
    };
  });
  report.observations.push({ label, route, theme, ...observation });
  return observation;
}

async function waitForReady(page, route, mode) {
  await page.locator("h1").waitFor();
  if (route === "/problems" && !mode.includes("error") && mode !== "empty-catalogue") {
    await page.getByRole("status", { name: "Problem result count" }).waitFor();
  }
  if (route === "/paths" && !mode.includes("error") && mode !== "empty-paths") {
    await page.getByText("Choose a path").waitFor();
  }
  if (route.includes("/paths/") && !mode.includes("error") && mode !== "detail-not-found") {
    await page.getByText("Path steps").waitFor();
  }
}

async function visit({ route, label, theme, width, mode = "populated", screenshot = false, fullPage = true, expectedFailure = false, reducedMotion = "no-preference" }) {
  const { context, counts } = await contextFor({ theme, width, mode, reducedMotion });
  const page = await context.newPage();
  observePage(page, label, expectedFailure);
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await waitForReady(page, route, mode);
  await page.waitForTimeout(450);
  const observation = await observeLayout(page, label, route, theme);
  if (screenshot) {
    const filename = `${label}.png`;
    await page.screenshot({ path: path.join(output, filename), fullPage, animations: "disabled" });
    report.screenshots.push(filename);
  }
  await context.close();
  return { observation, counts };
}

try {
  for (const route of ["/problems", "/paths", "/paths/array-foundations"]) {
    const routeName = route === "/problems" ? "problems" : route === "/paths" ? "paths" : "path-detail";
    for (const theme of ["dark", "light"]) {
      for (const width of [320, 390, 720, 768, 1024, 1440]) {
        await visit({
          route,
          label: `${routeName}-populated-${theme}-${width}`,
          theme,
          width,
          screenshot: (width === 390 && theme === "dark") || (width === 1440 && theme === "light"),
          fullPage: route !== "/problems",
        });
      }
    }
  }

  await visit({ route: "/problems", label: "problems-error-light-1440", theme: "light", width: 1440, mode: "catalogue-error", screenshot: true, expectedFailure: true });
  await visit({ route: "/paths", label: "paths-empty-light-1440", theme: "light", width: 1440, mode: "empty-paths", screenshot: true });
  await visit({ route: "/paths/array-foundations", label: "path-detail-error-dark-390", theme: "dark", width: 390, mode: "detail-error", screenshot: true, expectedFailure: true });

  const filterScenario = await contextFor({ theme: "dark", width: 1440 });
  const filterPage = await filterScenario.context.newPage();
  observePage(filterPage, "problems-combined-filters");
  await filterPage.goto(`${base}/problems`, { waitUntil: "networkidle" });
  await filterPage.getByRole("status", { name: "Problem result count" }).waitFor();
  await filterPage.getByLabel("Search problems").fill("window");
  await filterPage.getByLabel("Status").selectOption("solved");
  await filterPage.getByLabel("Topic").selectOption("Graphs");
  await filterPage.getByLabel("Company tag").selectOption("Meta");
  await filterPage.getByRole("button", { name: "Medium" }).click();
  await filterPage.getByRole("button", { name: "Saved problems only" }).click();
  const filteredCount = await filterPage.getByRole("status", { name: "Problem result count" }).textContent();
  const targetHref = await filterPage.getByRole("link", { name: /Sliding Graph Window/ }).getAttribute("href");
  const filterScreenshot = "problems-filtered-dark-1440.png";
  await filterPage.screenshot({ path: path.join(output, filterScreenshot), fullPage: true, animations: "disabled" });
  report.screenshots.push(filterScreenshot);
  await filterPage.getByLabel("Search problems").fill("nothing-can-match");
  const noMatchVisible = await filterPage.getByText("No problems match these filters").isVisible();
  await filterPage.getByRole("button", { name: "Clear all filters" }).first().click();
  const resetCount = await filterPage.getByRole("status", { name: "Problem result count" }).textContent();
  report.combinedFilters = { filteredCount, targetHref, noMatchVisible, resetCount };
  await filterScenario.context.close();

  const bookmarkScenario = await contextFor({ theme: "dark", width: 390 });
  const bookmarkPage = await bookmarkScenario.context.newPage();
  observePage(bookmarkPage, "problems-bookmark-independence");
  await bookmarkPage.goto(`${base}/problems`, { waitUntil: "networkidle" });
  const bookmarkButton = bookmarkPage.getByRole("button", { name: "Save Practice Problem 2", exact: true });
  await bookmarkButton.waitFor();
  const beforeUrl = bookmarkPage.url();
  await bookmarkButton.click();
  await bookmarkPage.getByRole("button", { name: "Remove Practice Problem 2 from saved problems", exact: true }).waitFor();
  report.bookmark = {
    beforeUrl,
    afterUrl: bookmarkPage.url(),
    addRequests: bookmarkScenario.counts.bookmarkAdds,
    nestedInteractive: await bookmarkPage.locator("a button, button a").count(),
    problemLinkHref: await bookmarkPage.getByRole("link", { name: /^Practice Problem 2\b/ }).getAttribute("href"),
  };
  await bookmarkScenario.context.close();

  const retryScenario = await contextFor({ theme: "light", width: 1024, mode: "catalogue-retry" });
  const retryPage = await retryScenario.context.newPage();
  observePage(retryPage, "problems-local-retry", true);
  await retryPage.goto(`${base}/problems`, { waitUntil: "networkidle" });
  await retryPage.getByRole("button", { name: "Retry catalogue" }).waitFor();
  const emptyMistakenlyShown = await retryPage.getByText("No problems are available yet").count();
  await retryPage.getByRole("button", { name: "Retry catalogue" }).click();
  await retryPage.getByRole("status", { name: "Problem result count" }).waitFor();
  report.catalogueRetry = { emptyMistakenlyShown, requests: retryScenario.counts.problems, recoveredCount: await retryPage.getByRole("status", { name: "Problem result count" }).textContent() };
  await retryScenario.context.close();

  const pathRetryScenario = await contextFor({ theme: "dark", width: 1024, mode: "paths-retry" });
  const pathRetryPage = await pathRetryScenario.context.newPage();
  observePage(pathRetryPage, "paths-local-retry", true);
  await pathRetryPage.goto(`${base}/paths`, { waitUntil: "networkidle" });
  await pathRetryPage.getByRole("button", { name: "Retry learning paths" }).waitFor();
  await pathRetryPage.getByRole("button", { name: "Retry learning paths" }).click();
  await pathRetryPage.getByText("Choose a path").waitFor();
  report.pathsRetry = { requests: pathRetryScenario.counts.paths, recovered: true };
  await pathRetryScenario.context.close();

  const detailScenario = await contextFor({ theme: "light", width: 1024, mode: "detail-retry" });
  const detailPage = await detailScenario.context.newPage();
  observePage(detailPage, "path-detail-local-retry", true);
  await detailPage.goto(`${base}/paths/array-foundations`, { waitUntil: "networkidle" });
  await detailPage.getByRole("button", { name: "Retry path" }).waitFor();
  const notFoundMistakenlyShown = await detailPage.getByText("Learning path not found").count();
  await detailPage.getByRole("button", { name: "Retry path" }).click();
  const nextLink = detailPage.getByRole("link", { name: "Continue with Longest Consecutive Sequence" });
  await nextLink.waitFor();
  report.pathDetail = {
    requests: detailScenario.counts.pathDetail,
    notFoundMistakenlyShown,
    nextHref: await nextLink.getAttribute("href"),
    upNextCount: await detailPage.getByText("Up next").count(),
    progressNow: await detailPage.getByRole("progressbar", { name: "Array Foundations progress" }).getAttribute("aria-valuenow"),
    stepLabels: await detailPage.getByText(/^Step \d of 4$/).allTextContents(),
  };
  await detailScenario.context.close();

  const motionScenario = await contextFor({ theme: "dark", width: 1440 });
  const motionPage = await motionScenario.context.newPage();
  observePage(motionPage, "problems-animation-cap");
  const motionStart = Date.now();
  await motionPage.goto(`${base}/problems`, { waitUntil: "domcontentloaded" });
  await motionPage.getByRole("status", { name: "Problem result count" }).waitFor();
  const rows = motionPage.locator("section[aria-labelledby='problem-results-title'] li");
  const rowCount = await rows.count();
  const lastRow = rows.last();
  let lastRowOpacity = Number(await lastRow.evaluate((element) => getComputedStyle(element).opacity));
  while (lastRowOpacity < 0.99 && Date.now() - motionStart < 1500) {
    await motionPage.waitForTimeout(25);
    lastRowOpacity = Number(await lastRow.evaluate((element) => getComputedStyle(element).opacity));
  }
  const lastRowVisibleMs = Date.now() - motionStart;
  report.motionCap = { rowCount, lastRowOpacity, lastRowVisibleMs, underThreshold: lastRowOpacity >= 0.99 && lastRowVisibleMs < 1500 };
  if (!report.motionCap.underThreshold || rowCount !== 150) throw new Error(`Catalogue animation cap failed: ${JSON.stringify(report.motionCap)}`);
  await motionScenario.context.close();

  const reducedScenario = await contextFor({ theme: "dark", width: 1024, reducedMotion: "reduce" });
  const reducedPage = await reducedScenario.context.newPage();
  observePage(reducedPage, "problems-reduced-motion");
  await reducedPage.goto(`${base}/problems`, { waitUntil: "networkidle" });
  await reducedPage.getByRole("status", { name: "Problem result count" }).waitFor();
  report.reducedMotion = await reducedPage.evaluate(() => ({
    preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
    activeInfinite: document.getAnimations().filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity).length,
    nestedInteractive: document.querySelectorAll("a button, button a").length,
  }));
  await reducedScenario.context.close();

  const failures = [];
  if (report.observations.length !== 39) failures.push(`expected 39 observations, received ${report.observations.length}`);
  if (report.screenshots.length !== 10 || new Set(report.screenshots).size !== 10) failures.push("screenshot list is incomplete or contains duplicates");
  if (report.consoleErrors.length) failures.push(`${report.consoleErrors.length} unexpected console errors`);
  if (report.pageErrors.length) failures.push(`${report.pageErrors.length} page errors`);
  if (report.observations.some((item) => item.horizontalOverflow)) failures.push("page-level horizontal overflow detected");
  if (report.observations.some((item) => item.clippedControls.length)) failures.push("visible controls clipped by the viewport");
  if (report.observations.some((item) => item.nestedInteractive !== 0)) failures.push("nested interactive controls detected");
  if (report.combinedFilters.filteredCount !== "Showing 1 of 150 matching problems" || report.combinedFilters.targetHref !== "/problems/sliding-graph-window" || !report.combinedFilters.noMatchVisible || report.combinedFilters.resetCount !== "Showing 150 of 150 problems") failures.push("combined catalogue filter flow failed");
  if (report.bookmark.beforeUrl !== report.bookmark.afterUrl || report.bookmark.addRequests !== 1 || report.bookmark.nestedInteractive !== 0 || report.bookmark.problemLinkHref !== "/problems/problem-002") failures.push("bookmark independence flow failed");
  if (report.catalogueRetry.emptyMistakenlyShown !== 0 || report.catalogueRetry.requests !== 2 || report.catalogueRetry.recoveredCount !== "Showing 150 of 150 problems") failures.push("catalogue retry flow failed");
  if (report.pathsRetry.requests !== 2 || !report.pathsRetry.recovered) failures.push("learning-path list retry failed");
  if (report.pathDetail.requests !== 2 || report.pathDetail.notFoundMistakenlyShown !== 0 || report.pathDetail.nextHref !== "/problems/problem-003" || report.pathDetail.upNextCount !== 1 || report.pathDetail.progressNow !== "2") failures.push("learning-path detail recovery or next-step flow failed");
  if (report.pathDetail.stepLabels.join("|") !== "Step 1 of 4|Step 2 of 4|Step 3 of 4|Step 4 of 4") failures.push("zero-based path positions were not presented as one-based steps");
  if (!report.motionCap.underThreshold || report.motionCap.rowCount !== 150) failures.push("catalogue animation cap failed");
  if (!report.reducedMotion.preference || report.reducedMotion.activeInfinite !== 0 || report.reducedMotion.nestedInteractive !== 0) failures.push("reduced-motion or interaction semantics failed");
  if (failures.length) throw new Error(`Phase 4 browser verification failed:\n- ${failures.join("\n- ")}`);

  await fs.writeFile(path.join(output, "browser-phase4.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
