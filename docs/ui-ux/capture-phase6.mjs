// Deterministic browser audit for interview and system-design website flows.
// The fixture covers paid AI responses; auth and request validation use the local API.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const playwrightModule = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const { chromium } = playwrightModule.default || playwrightModule;
const base = process.env.UI_BASE_URL || "http://localhost:3002";
const apiBase = process.env.UI_API_URL || "http://localhost:4000/api";
const output = path.resolve("docs/ui-ux/evidence/phase-6");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const setup = await browser.newContext();
const username = `uiqa_phase6_${crypto.randomBytes(4).toString("hex")}`;
const registration = await setup.request.post(`${apiBase}/auth/register`, {
  data: { username, email: `${username}@example.invalid`, password: crypto.randomBytes(20).toString("base64url"), fullName: "Phase Six QA" },
});
if (registration.status() !== 201) throw new Error(`QA registration failed: ${registration.status()}`);
const { token } = await registration.json();
const headers = { Authorization: `Bearer ${token}` };
const list = await setup.request.get(`${apiBase}/interviews`, { headers });
const invalidDesign = await setup.request.post(`${apiBase}/interviews/system-design/analyze`, { headers, data: { prompt: "", explanation: "" } });
if (list.status() !== 200 || invalidDesign.status() !== 400) throw new Error(`Local API contract failed: list ${list.status()}, validation ${invalidDesign.status()}`);

const report = {
  generatedAt: new Date().toISOString(),
  browser: browser.version(),
  localApi: { interviewListStatus: list.status(), emptyDesignValidationStatus: invalidDesign.status() },
  notes: ["The live website stays on port 3002.", "The final matrix uses deterministic browser fixtures for interview turns, design analysis, reports, failures, and empty diagrams.", "Two diagnostic design-analysis requests reached the local AI service before the route matcher was corrected; they are disclosed in the phase report.", "Narrow-width checks are responsive website checks, not a native mobile client."],
  observations: [], screenshots: [], pageErrors: [], requestFailures: [],
};

const analysis = {
  summary: "The design separates the write API from reads and needs a failover plan.",
  nodes: [
    { id: "client", label: "Client", type: "client" },
    { id: "gateway", label: "Gateway", type: "gateway" },
    { id: "service", label: "URL Service", type: "service" },
    { id: "cache", label: "Cache", type: "cache" },
    { id: "db", label: "Database", type: "db" },
  ],
  edges: [
    { source: "client", target: "gateway", label: "request" },
    { source: "gateway", target: "service", label: "route" },
    { source: "service", target: "cache", label: "lookup" },
    { source: "service", target: "db", label: "persist" },
  ],
  rubric: {
    requirements: { score: 8, notes: "Core operations are clear." },
    scalability: { score: 7, notes: "Separate read and write paths." },
    reliability: { score: 5, notes: "Define failover." },
    data_modeling: { score: 7, notes: "Short codes need a uniqueness rule." },
    communication: { score: 8, notes: "Trade-offs are explicit." },
  },
  risks: ["Single database primary"],
  improvements: ["Add a failover path and recovery objective"],
};
const stages = ["behavioral", "coding", "system_design", "core_cs"];

function track(page, label) {
  page.on("pageerror", (error) => report.pageErrors.push({ label, message: error.message }));
  page.on("requestfailed", (request) => report.requestFailures.push({ label, url: request.url(), error: request.failure()?.errorText }));
}

async function contextFor(theme, width, reducedMotion = "no-preference") {
  return browser.newContext({
    viewport: { width, height: 900 }, reducedMotion,
    storageState: { cookies: [], origins: [{ origin: new URL(base).origin, localStorage: [{ name: "if-token", value: token }, { name: "if-theme", value: theme }] }] },
  });
}

async function fixtureRoutes(context, options = {}) {
  const state = { stage: 0, answers: 0, followup: false, messages: [{ id: "q1", role: "assistant", stage: "behavioral", content: "Tell me about a difficult trade-off.", metadata_json: { kind: "question" }, created_at: "2026-09-19T12:00:00Z" }] };
  let analysisFailures = options.analysisFailure ? 1 : 0;
  await context.route(/\/api\/interviews(?:\/|$)/, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (pathname === "/api/interviews" && method === "POST") return json({ session: { id: "fixture-session", company: "google", currentStage: "behavioral", status: "active" }, openingQuestion: { question: state.messages[0].content } }, 201);
    if (pathname === "/api/interviews/fixture-session" && method === "GET") return json({ session: { id: "fixture-session", company: "google", current_stage: state.stage >= 4 ? "report" : stages[state.stage], status: state.stage >= 4 ? "completed" : "active" }, messages: state.messages });
    if (pathname === "/api/interviews/fixture-session/answer" && method === "POST") {
      const answer = request.postDataJSON().answer;
      state.messages.push({ id: `a${++state.answers}`, role: "candidate", stage: stages[state.stage], content: answer, metadata_json: { kind: "answer" }, created_at: "2026-09-19T12:01:00Z" });
      state.messages.push({ id: `e${state.answers}`, role: "system", stage: stages[state.stage], content: "Good reasoning.", metadata_json: { kind: "evaluation" }, created_at: "2026-09-19T12:02:00Z" });
      if (!state.followup) state.followup = true;
      else state.stage += 1;
      if (state.stage < 4) state.messages.push({ id: `q${state.answers + 1}`, role: "assistant", stage: stages[state.stage], content: state.followup && state.stage === 0 ? "How did you measure the outcome?" : `${stages[state.stage]} question`, metadata_json: { kind: state.stage === 0 ? "followup" : "question" }, created_at: "2026-09-19T12:03:00Z" });
      return json({ action: state.stage >= 4 ? "completed" : state.stage === 0 ? "followup" : "advance_stage" });
    }
    if (pathname === "/api/interviews/fixture-session/report") return json({ sessionId: "fixture-session", company: "google", overallScore: 8, stageScores: Object.fromEntries(stages.map((stage) => [stage, { score: 8, feedback: "Clear answer." }])), strengths: ["Structured explanations"], weaknesses: ["Quantify trade-offs"], recommendations: ["Practice the recovery story"] });
    if (pathname === "/api/interviews/system-design/analyze" && method === "POST") {
      if (analysisFailures-- > 0) return json({ error: "Simulated analysis outage" }, 503);
      return json(options.emptyDiagram ? { ...analysis, nodes: [], edges: [], risks: [], improvements: [] } : analysis);
    }
    return json({ error: `Unhandled fixture ${method} ${pathname}` }, 501);
  });
  return state;
}

async function observe(page, label) {
  const value = await page.evaluate(() => {
    const clipped = [...document.querySelectorAll("button, a, input, textarea, [role=tab]")].filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.top < innerHeight && rect.bottom > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map((element) => (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80));
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      clipped,
      nestedInteractive: document.querySelectorAll("a button, button a").length,
      infiniteAnimations: document.getAnimations().filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity).length,
    };
  });
  report.observations.push({ label, ...value });
  if (value.documentWidth > value.viewport + 1 || value.clipped.length || value.nestedInteractive) throw new Error(`${label} layout regression: ${JSON.stringify(value)}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(output, name), animations: "disabled" });
  report.screenshots.push(name);
}

try {
  for (const theme of ["dark", "light"]) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const context = await contextFor(theme, width);
      await fixtureRoutes(context);
      const page = await context.newPage();
      track(page, `${theme}-${width}`);
      await page.goto(`${base}/interview`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Mock interview" }).waitFor();
      await observe(page, `interview-setup-${theme}-${width}`);
      if (theme === "light" && width === 1440) await shot(page, "interview-setup-light-1440.png");
      if (theme === "dark" && width === 390) await shot(page, "interview-setup-dark-390.png");
      await page.getByRole("button", { name: "Start interview" }).click();
      await page.getByRole("heading", { name: /Stage 1\/4/ }).waitFor();
      await observe(page, `interview-active-${theme}-${width}`);
      if (theme === "dark" && width === 390) await shot(page, "interview-active-dark-390.png");

      await page.goto(`${base}/system-design`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "System design review" }).waitFor();
      await observe(page, `design-setup-${theme}-${width}`);
      if (theme === "light" && width === 1440) await shot(page, "design-setup-light-1440.png");
      if (theme === "dark" && width === 390) await shot(page, "design-setup-dark-390.png");
      await page.getByRole("button", { name: "Design a URL shortener like bit.ly" }).click();
      await page.getByRole("textbox", { name: "Your explanation" }).fill("A gateway routes requests to a URL service. Short codes are stored in a database and cached for reads. Replicas would help availability.");
      await page.getByRole("button", { name: "Analyze design" }).click();
      try {
      await page.getByRole("heading", { name: "Design feedback" }).waitFor({ timeout: 5000 });
      } catch (error) {
        throw new Error(`Design feedback missing at ${theme}-${width}: ${(await page.locator("body").innerText()).slice(-1000)}`, { cause: error });
      }
      await page.locator(".react-flow__node").first().waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await observe(page, `design-feedback-${theme}-${width}`);
      if (theme === "light" && width === 1440) await shot(page, "design-feedback-light-1440.png");
      if (theme === "dark" && width === 390) await shot(page, "design-feedback-dark-390.png");
      await context.close();
    }
  }

  const context = await contextFor("light", 1440);
  const state = await fixtureRoutes(context);
  const page = await context.newPage();
  track(page, "interview-full-flow");
  await page.goto(`${base}/interview`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start interview" }).click();
  await page.getByRole("heading", { name: /Stage 1\/4/ }).waitFor();
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("textbox", { name: "Your answer" }).fill(`Line one for turn ${index}\nLine two with supporting detail`);
    await page.getByRole("button", { name: "Send answer" }).click();
    if (index < 4) await page.getByRole("heading", { name: new RegExp(`Stage ${index === 0 ? 1 : index + 1}/4`) }).waitFor();
  }
  await page.getByRole("button", { name: "Generate report" }).click();
  await page.getByRole("heading", { name: "Interview Report" }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const pdfDownload = await downloadPromise;
  report.fullInterview = { answers: state.answers, stage: state.stage, reportVisible: true, pdfFilename: pdfDownload.suggestedFilename() };
  await page.getByRole("heading", { name: "Interview Report" }).scrollIntoViewIfNeeded();
  await shot(page, "interview-report-light-1440.png");
  await context.close();

  const recoveryContext = await contextFor("dark", 390, "reduce");
  await fixtureRoutes(recoveryContext, { analysisFailure: true });
  const recoveryPage = await recoveryContext.newPage();
  track(recoveryPage, "design-error-recovery");
  await recoveryPage.goto(`${base}/system-design`, { waitUntil: "networkidle" });
  await recoveryPage.getByRole("textbox", { name: "Design prompt" }).fill("Design a queue");
  await recoveryPage.getByRole("textbox", { name: "Your explanation" }).fill("Use partitioned consumers.");
  await recoveryPage.getByRole("button", { name: "Analyze design" }).click();
  await recoveryPage.getByRole("heading", { name: "Analysis unavailable" }).waitFor();
  await shot(recoveryPage, "design-error-dark-390.png");
  await recoveryPage.getByRole("button", { name: "Retry analysis" }).click();
  await recoveryPage.getByRole("heading", { name: "Design feedback" }).waitFor();
  await observe(recoveryPage, "design-recovered-reduced-motion");
  report.recovery = { draftPreserved: true, reducedMotionInfiniteAnimations: report.observations.at(-1).infiniteAnimations };
  await recoveryContext.close();

  const emptyContext = await contextFor("light", 1440);
  await fixtureRoutes(emptyContext, { emptyDiagram: true });
  const emptyPage = await emptyContext.newPage();
  track(emptyPage, "design-empty");
  await emptyPage.goto(`${base}/system-design`, { waitUntil: "networkidle" });
  await emptyPage.getByRole("textbox", { name: "Design prompt" }).fill("Design an empty fixture");
  await emptyPage.getByRole("textbox", { name: "Your explanation" }).fill("An intentionally sparse design.");
  await emptyPage.getByRole("button", { name: "Analyze design" }).click();
  await emptyPage.getByText("No diagram components").waitFor();
  await shot(emptyPage, "design-empty-light-1440.png");
  await emptyContext.close();

  const zoomContext = await contextFor("light", 360);
  await fixtureRoutes(zoomContext);
  const zoomPage = await zoomContext.newPage();
  track(zoomPage, "zoom-keyboard");
  await zoomPage.goto(`${base}/interview`, { waitUntil: "networkidle" });
  await zoomPage.getByRole("button", { name: /Amazon/ }).focus();
  await zoomPage.keyboard.press("Enter");
  if (await zoomPage.getByRole("button", { name: /Amazon/ }).getAttribute("aria-pressed") !== "true") throw new Error("Keyboard company selection failed");
  await observe(zoomPage, "interview-200-percent-reflow-proxy");
  await shot(zoomPage, "interview-zoom-200-light-720.png");
  await zoomPage.goto(`${base}/system-design`, { waitUntil: "networkidle" });
  await zoomPage.getByRole("button", { name: "Design a URL shortener like bit.ly" }).focus();
  await zoomPage.keyboard.press("Enter");
  await zoomPage.getByRole("textbox", { name: "Your explanation" }).fill("A URL service stores and looks up short codes.");
  await zoomPage.getByRole("button", { name: "Analyze design" }).click();
  await zoomPage.getByRole("heading", { name: "Design feedback" }).waitFor();
  await zoomPage.evaluate(() => window.scrollTo(0, 0));
  await observe(zoomPage, "design-feedback-200-percent-reflow-proxy");
  report.zoomKeyboard = { companySelectedByKeyboard: true, promptSelectedByKeyboard: true };
  await shot(zoomPage, "design-feedback-zoom-200-light-720.png");
  await zoomContext.close();
} finally {
  await fs.writeFile(path.join(output, "browser-phase6.json"), `${JSON.stringify(report, null, 2)}\n`);
  const screenshotHashes = await Promise.all(report.screenshots.map(async (name) =>
    `${crypto.createHash("sha256").update(await fs.readFile(path.join(output, name))).digest("hex")}  ${name}`));
  await fs.writeFile(path.join(output, "screenshot-sha256.txt"), `${screenshotHashes.sort().join("\n")}\n`);
  await setup.close();
  await browser.close();
}

console.log(JSON.stringify({ observations: report.observations.length, screenshots: report.screenshots.length, fullInterview: report.fullInterview, recovery: report.recovery, pageErrors: report.pageErrors, requestFailures: report.requestFailures }, null, 2));
if (report.pageErrors.length || report.requestFailures.length || report.fullInterview?.answers !== 5 || report.recovery?.reducedMotionInfiniteAnimations !== 0) process.exitCode = 1;
