// Phase 5 browser audit for the responsive website workspaces.
// Uses a disposable QA account and real local Run/Submit APIs. Response fixtures
// are used only for named loading/error/empty/deadline scenarios.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const playwrightModule = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const { chromium } = playwrightModule.default || playwrightModule;
const base = process.env.UI_BASE_URL || "http://localhost:3002";
const apiBase = process.env.UI_API_URL || "http://localhost:4000/api";
const output = path.resolve(process.env.UI_EVIDENCE_DIR || "docs/ui-ux/evidence/phase-5");
const browser = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir(output, { recursive: true });

const report = {
  base,
  apiBase,
  browser: browser.version(),
  generatedAt: new Date().toISOString(),
  screenshots: [],
  observations: [],
  pageErrors: [],
  requestFailures: [],
  notes: [
    "The QA account and assessments are disposable synthetic records.",
    "Problem catalogue, code execution, submission persistence, assessment linking, and completion use real local services.",
    "Only explicitly named error, empty, and short-deadline checks use browser response fixtures.",
    "Phone-width checks exercise the responsive website; no native mobile application is in scope.",
  ],
};

const setup = await browser.newContext();
const username = `uiqa_phase5_${crypto.randomBytes(4).toString("hex")}`;
const password = crypto.randomBytes(24).toString("base64url");
const registration = await setup.request.post(`${apiBase}/auth/register`, {
  data: { username, password, email: `${username}@example.invalid`, fullName: "Phase Five QA" },
});
if (registration.status() !== 201) throw new Error(`QA registration failed: ${registration.status()}`);
const { token } = await registration.json();
const headers = { Authorization: `Bearer ${token}` };
const catalogueResponse = await setup.request.get(`${apiBase}/problems`, { headers });
if (!catalogueResponse.ok()) throw new Error(`Catalogue request failed: ${catalogueResponse.status()}`);
const catalogue = await catalogueResponse.json();
const problem = catalogue.problems.find((item) => item.slug === "two-sum") || catalogue.problems[0];
if (!problem) throw new Error("No problem available for browser verification");

async function createAssessment(minutes = 60) {
  const response = await setup.request.post(`${apiBase}/assessments`, {
    headers,
    data: { timeLimitMinutes: minutes, problemCount: 2, difficultyMix: "easy" },
  });
  if (!response.ok()) throw new Error(`Assessment creation failed: ${response.status()}`);
  return response.json();
}

const displayAssessment = await createAssessment();
const deadlineAssessment = await createAssessment();
report.qa = {
  username,
  problemId: problem.id,
  displayAssessmentId: displayAssessment.assessmentId,
  deadlineAssessmentId: deadlineAssessment.assessmentId,
};

function observePage(page, label, expectedFailure = false) {
  page.on("pageerror", (error) => report.pageErrors.push({ label, expectedFailure, message: error.message }));
  page.on("requestfailed", (request) => report.requestFailures.push({
    label,
    expectedFailure,
    url: request.url(),
    error: request.failure()?.errorText || "unknown",
  }));
}

async function contextFor({ theme = "dark", width = 1440, height = 900, reducedMotion = "no-preference" } = {}) {
  return browser.newContext({
    viewport: { width, height },
    reducedMotion,
    permissions: ["clipboard-read", "clipboard-write"],
    storageState: {
      cookies: [],
      origins: [{
        origin: new URL(base).origin,
        localStorage: [
          { name: "if-token", value: token },
          { name: "if-theme", value: theme },
          { name: "if-preferred-lang", value: "python3" },
        ],
      }],
    },
  });
}

async function waitForWorkspace(page, kind) {
  if (kind === "problem") {
    await page.getByRole("heading", { name: problem.title, exact: true }).waitFor();
  } else {
    await page.getByRole("heading", { name: "Coding assessment", exact: true }).waitFor();
  }
  await page.locator(".monaco-editor").first().waitFor({ state: "attached" });
}

async function observeLayout(page, label, route, theme, extra = {}) {
  const observation = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const clippedControls = [...document.querySelectorAll("a, button, input, select, [role=separator]")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return visible(element) && rect.top < innerHeight && rect.bottom > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
      })
      .map((element) => (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80));
    const editor = document.querySelector(".monaco-editor");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      clippedControls,
      nestedInteractive: document.querySelectorAll("a button, button a").length,
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      editorBackground: editor ? getComputedStyle(editor).backgroundColor : null,
      activeInfiniteAnimations: document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getTiming();
        return animation.playState === "running" && timing?.iterations === Infinity;
      }).length,
    };
  });
  report.observations.push({ label, route, theme, ...observation, ...extra });
  if (observation.horizontalOverflow || observation.clippedControls.length || observation.nestedInteractive) {
    throw new Error(`${label} layout regression: ${JSON.stringify(observation)}`);
  }
  return observation;
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(output, filename), animations: "disabled" });
  report.screenshots.push(filename);
}

async function openEditorPane(page) {
  const button = page.getByRole("button", { name: "Editor", exact: true });
  if (await button.isVisible()) await button.click();
  await page.locator(".monaco-editor").first().waitFor({ state: "visible" });
}

async function replaceEditorCode(page, value) {
  await openEditorPane(page);
  const editor = page.locator(".monaco-editor").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.evaluate(async (code) => navigator.clipboard.writeText(code), value);
  await page.keyboard.press("ControlOrMeta+V");
}

async function workspaceMatrix() {
  for (const theme of ["dark", "light"]) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const context = await contextFor({ theme, width });
      const page = await context.newPage();
      const labelBase = `${theme}-${width}`;
      observePage(page, `matrix-${labelBase}`);

      await page.goto(`${base}/assessments`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Coding assessments" }).waitFor();
      await observeLayout(page, `assessments-${labelBase}`, "/assessments", theme);
      if (theme === "light" && width === 1440) await screenshot(page, "assessments-light-1440.png");

      await page.goto(`${base}/problems/${problem.id}`, { waitUntil: "networkidle" });
      await waitForWorkspace(page, "problem");
      await observeLayout(page, `problem-${labelBase}`, `/problems/${problem.id}`, theme);
      if (theme === "dark" && width === 320) await screenshot(page, "problem-dark-320.png");
      if (theme === "light" && width === 1440) await screenshot(page, "problem-light-1440.png");

      await page.goto(`${base}/assessments/${displayAssessment.assessmentId}`, { waitUntil: "networkidle" });
      await waitForWorkspace(page, "assessment");
      await observeLayout(page, `assessment-workspace-${labelBase}`, `/assessments/${displayAssessment.assessmentId}`, theme);
      if (theme === "dark" && width === 390) await screenshot(page, "assessment-problem-dark-390.png");
      if (theme === "light" && width === 1440) await screenshot(page, "assessment-workspace-light-1440.png");
      await context.close();
    }
  }
}

async function problemInteractions() {
  const smallContext = await contextFor({ theme: "dark", width: 390 });
  const smallPage = await smallContext.newPage();
  observePage(smallPage, "problem-pane-retention");
  let paneRunBody = null;
  smallPage.on("request", (request) => {
    if (request.method() === "POST" && request.url() === `${apiBase}/submissions`) {
      const body = request.postDataJSON();
      if (body.mode === "run") paneRunBody = body;
    }
  });
  await smallPage.goto(`${base}/problems/${problem.id}`, { waitUntil: "networkidle" });
  await waitForWorkspace(smallPage, "problem");
  await replaceEditorCode(smallPage, "class Solution:\n    def twoSum(self, nums, target):\n        return []  # pane-state-marker");
  await smallPage.getByRole("button", { name: "Problem", exact: true }).click();
  await smallPage.getByRole("button", { name: "Editor", exact: true }).click();
  const runResponsePromise = smallPage.waitForResponse((response) => response.url() === `${apiBase}/submissions` && response.request().method() === "POST");
  await smallPage.getByRole("button", { name: "Run code" }).click();
  const runResponse = await runResponsePromise;
  await smallPage.getByRole("tab", { name: /Result/ }).waitFor();
  if (!paneRunBody?.code?.includes("pane-state-marker")) throw new Error("Small-screen pane switch lost editor code");
  report.problemPaneRetention = {
    requestStatus: runResponse.status(),
    markerPreserved: true,
    resultVisible: await smallPage.getByRole("tab", { name: /Result/ }).isVisible(),
  };
  await screenshot(smallPage, "problem-editor-result-dark-390.png");
  await smallContext.close();

  const context = await contextFor({ theme: "light", width: 1440 });
  const page = await context.newPage();
  observePage(page, "problem-real-execution");
  await page.goto(`${base}/problems/${problem.id}`, { waitUntil: "networkidle" });
  await waitForWorkspace(page, "problem");
  const solution = [
    "class Solution:",
    "    def twoSum(self, nums, target):",
    "        seen = {}",
    "        for index, value in enumerate(nums):",
    "            if target - value in seen:",
    "                return [seen[target - value], index]",
    "            seen[value] = index",
    "        return []",
  ].join("\n");
  await replaceEditorCode(page, solution);

  const passRunPromise = page.waitForResponse((response) => response.url() === `${apiBase}/submissions` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Run code" }).click();
  const passRun = await passRunPromise;
  const passRunPayload = await passRun.json();
  if (!passRunPayload.passed) {
    throw new Error(`Real browser run failed: ${JSON.stringify({ request: passRun.request().postDataJSON(), response: passRunPayload })}`);
  }
  await page.getByText("All Sample Cases Passed").waitFor();

  const submitPromise = page.waitForResponse((response) => response.url() === `${apiBase}/submissions` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const submitResponse = await submitPromise;
  const submitPayload = await submitResponse.json();
  await page.getByText("Accepted", { exact: true }).first().waitFor();

  const separator = page.getByRole("separator", { name: "Resize editor and console panels" });
  const before = Number(await separator.getAttribute("aria-valuenow"));
  await separator.focus();
  await page.keyboard.press("ArrowUp");
  const after = Number(await separator.getAttribute("aria-valuenow"));
  if (!(after > before)) throw new Error("Keyboard console resize did not increase the split");

  const languageSnippets = {};
  for (const language of ["cpp", "c", "java", "python3"]) {
    await page.getByLabel("Language").selectOption(language);
    await page.waitForTimeout(250);
    languageSnippets[language] = (await page.locator(".view-lines").first().innerText()).slice(0, 100);
  }
  if (!languageSnippets.python3.includes("seen")) throw new Error("Python draft was not restored after all language switches");

  await page.reload({ waitUntil: "networkidle" });
  await waitForWorkspace(page, "problem");
  const restored = (await page.locator(".view-lines").first().innerText()).includes("seen");
  if (!restored) throw new Error("Latest submitted code was not restored after reload");

  await page.getByRole("tab", { name: "Hints" }).click();
  await page.getByRole("button", { name: "Show hint 1" }).click();
  const hintsVisible = await page.getByText("Hint 1", { exact: true }).isVisible();
  await page.getByRole("tab", { name: "Editorial" }).click();
  const editorialVisible = await page.getByText("hash map", { exact: false }).first().isVisible();
  await page.getByRole("tab", { name: "AI Review" }).click();
  const aiReviewUnlocked = await page.getByRole("button", { name: /generate ai review/i }).isEnabled();

  report.realProblemExecution = {
    runStatus: passRun.status(),
    runPassed: passRunPayload.passed,
    submitStatus: submitResponse.status(),
    submitPassed: submitPayload.passed,
    submissionId: submitPayload.submissionId,
    latestSubmissionRestored: restored,
    learningSurfaces: { hintsVisible, editorialVisible, aiReviewUnlocked },
    languageSnippets,
    keyboardSplit: { before, after },
  };
  await screenshot(page, "problem-accepted-light-1440.png");
  await context.close();
}

async function assessmentInteractions() {
  const context = await contextFor({ theme: "dark", width: 390 });
  const page = await context.newPage();
  observePage(page, "assessment-real-submission");
  await page.goto(`${base}/assessments/${deadlineAssessment.assessmentId}`, { waitUntil: "networkidle" });
  await waitForWorkspace(page, "assessment");
  await openEditorPane(page);
  const submitPromise = page.waitForResponse((response) => response.url() === `${apiBase}/submissions` && response.request().method() === "POST");
  const linkPromise = page.waitForResponse((response) => response.url().endsWith(`/assessments/${deadlineAssessment.assessmentId}/solve`));
  await page.getByRole("button", { name: "Submit problem" }).click();
  const submitResponse = await submitPromise;
  const submitPayload = await submitResponse.json();
  const linkResponse = await linkPromise;
  report.realAssessmentSubmission = {
    submissionStatus: submitResponse.status(),
    submissionId: submitPayload.submissionId,
    linkStatus: linkResponse.status(),
  };
  await context.close();

  const deadlineContext = await contextFor({ theme: "light", width: 1440 });
  await deadlineContext.route(`${apiBase}/assessments/${deadlineAssessment.assessmentId}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, remainingMs: 1_200 } });
  });
  const deadlinePage = await deadlineContext.newPage();
  observePage(deadlinePage, "assessment-short-deadline");
  const finishPromise = deadlinePage.waitForResponse((response) => response.url().endsWith(`/assessments/${deadlineAssessment.assessmentId}/submit`));
  await deadlinePage.goto(`${base}/assessments/${deadlineAssessment.assessmentId}`, { waitUntil: "domcontentloaded" });
  await waitForWorkspace(deadlinePage, "assessment");
  const finishResponse = await finishPromise;
  const finishPayload = await finishResponse.json();
  await deadlinePage.getByText("Assessment results").waitFor();
  report.deadlineCompletion = {
    fixtureRemainingMs: 1_200,
    responseStatus: finishResponse.status(),
    score: finishPayload.score,
    status: finishPayload.status,
  };
  await screenshot(deadlinePage, "assessment-timeout-results-light-1440.png");
  await deadlineContext.close();
}

async function stateAndAccessibilityChecks() {
  const errorContext = await contextFor({ theme: "light", width: 1440 });
  let failProblemOnce = true;
  await errorContext.route(`${apiBase}/problems/${problem.id}`, async (route) => {
    if (failProblemOnce) {
      failProblemOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Simulated problem outage" }) });
    } else {
      await route.continue();
    }
  });
  const errorPage = await errorContext.newPage();
  observePage(errorPage, "problem-error-recovery", true);
  await errorPage.goto(`${base}/problems/${problem.id}`, { waitUntil: "networkidle" });
  await errorPage.getByRole("alert").filter({ hasText: "Problem unavailable" }).waitFor();
  await screenshot(errorPage, "problem-error-light-1440.png");
  await errorPage.getByRole("button", { name: "Retry", exact: true }).click();
  await waitForWorkspace(errorPage, "problem");
  report.problemErrorRecovery = { retryRecovered: true };
  await errorContext.close();

  const historyContext = await contextFor({ theme: "dark", width: 390 });
  let failHistoryOnce = true;
  await historyContext.route(`${apiBase}/assessments`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    if (failHistoryOnce) {
      failHistoryOnce = false;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Simulated history outage" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ assessments: [] }) });
  });
  const historyPage = await historyContext.newPage();
  observePage(historyPage, "assessment-history-error-empty", true);
  await historyPage.goto(`${base}/assessments`, { waitUntil: "networkidle" });
  await historyPage.getByText("Assessments could not be loaded").waitFor();
  await screenshot(historyPage, "assessments-error-dark-390.png");
  await historyPage.getByRole("button", { name: "Retry assessments" }).click();
  await historyPage.getByText("No assessments yet").waitFor();
  report.assessmentHistoryRecovery = { errorVisible: true, emptyAfterRetry: true };
  await historyContext.close();

  const reducedContext = await contextFor({ theme: "dark", width: 390, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  observePage(reducedPage, "problem-reduced-motion");
  await reducedPage.goto(`${base}/problems/${problem.id}`, { waitUntil: "networkidle" });
  await waitForWorkspace(reducedPage, "problem");
  const reduced = await observeLayout(reducedPage, "problem-reduced-motion", `/problems/${problem.id}`, "dark", { reducedMotion: true });
  if (reduced.activeInfiniteAnimations !== 0) throw new Error("Reduced-motion workspace has an infinite animation");
  report.reducedMotion = { activeInfiniteAnimations: reduced.activeInfiniteAnimations };
  await reducedContext.close();

  const zoomContext = await contextFor({ theme: "light", width: 720, height: 900 });
  const zoomPage = await zoomContext.newPage();
  observePage(zoomPage, "problem-200-percent-zoom");
  await zoomPage.goto(`${base}/problems/${problem.id}`, { waitUntil: "networkidle" });
  await waitForWorkspace(zoomPage, "problem");
  await zoomPage.evaluate(() => { document.body.style.zoom = "200%"; });
  await zoomPage.waitForTimeout(100);
  const zoom = await observeLayout(zoomPage, "problem-200-percent-zoom", `/problems/${problem.id}`, "light", { cssZoom: "200%" });
  report.zoom = { horizontalOverflow: zoom.horizontalOverflow, clippedControls: zoom.clippedControls };
  await screenshot(zoomPage, "problem-light-720-zoom-200.png");
  await zoomContext.close();
}

try {
  await workspaceMatrix();
  await problemInteractions();
  await assessmentInteractions();
  await stateAndAccessibilityChecks();
} finally {
  const groupedErrors = new Map();
  for (const error of report.pageErrors) {
    const key = `${error.label}:${error.message.split("\n")[0]}`;
    const existing = groupedErrors.get(key);
    if (existing) existing.count += 1;
    else groupedErrors.set(key, { ...error, count: 1 });
  }
  report.pageErrors = [...groupedErrors.values()];
  await fs.writeFile(path.join(output, "browser-phase5.json"), `${JSON.stringify(report, null, 2)}\n`);
  await setup.close();
  await browser.close();
}

console.log(JSON.stringify({
  screenshots: report.screenshots.length,
  observations: report.observations.length,
  realProblemExecution: report.realProblemExecution,
  realAssessmentSubmission: report.realAssessmentSubmission,
  deadlineCompletion: report.deadlineCompletion,
  problemPaneRetention: report.problemPaneRetention,
  pageErrors: report.pageErrors,
  requestFailures: report.requestFailures,
}, null, 2));
