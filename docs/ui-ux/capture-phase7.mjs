// Final website route matrix. Runs against the existing web port and local API.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const playwrightModule = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const { chromium } = playwrightModule.default || playwrightModule;
const base = process.env.UI_BASE_URL || "http://localhost:3002";
const apiBase = process.env.UI_API_URL || "http://localhost:4000/api";
const output = path.resolve("docs/ui-ux/evidence/phase-7");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const setup = await browser.newContext();
const username = `uiqa_phase7_${crypto.randomBytes(4).toString("hex")}`;
const registration = await setup.request.post(`${apiBase}/auth/register`, {
  data: { username, email: `${username}@example.invalid`, password: crypto.randomBytes(20).toString("base64url"), fullName: "Phase Seven QA" },
});
if (registration.status() !== 201) throw new Error(`QA registration failed: ${registration.status()}`);
const { token } = await registration.json();
const problems = await setup.request.get(`${apiBase}/problems`, { headers: { Authorization: `Bearer ${token}` } });
if (problems.status() !== 200) throw new Error(`Problem catalogue failed: ${problems.status()}`);
const problemId = (await problems.json()).problems?.[0]?.id;
const paths = await setup.request.get(`${apiBase}/learning-paths`, { headers: { Authorization: `Bearer ${token}` } });
if (paths.status() !== 200) throw new Error(`Learning paths failed: ${paths.status()}`);
const pathSlug = (await paths.json()).paths?.[0]?.slug;
const assessment = await setup.request.post(`${apiBase}/assessments`, { headers: { Authorization: `Bearer ${token}` }, data: { timeLimitMinutes: 60, problemCount: 2 } });
if (assessment.status() !== 201) throw new Error(`QA assessment setup failed: ${assessment.status()}`);
const assessmentId = (await assessment.json()).assessmentId;

const report = { generatedAt: new Date().toISOString(), browser: browser.version(), websitePort: 3002, routes: [], states: [], screenshots: [], pageErrors: [], requestFailures: [], notes: ["Narrow widths test the responsive website, not a native mobile app.", "No paid AI endpoint is invoked."] };
const routes = ["/", "/dashboard", "/problems", "/assessments", `/assessments/${assessmentId}`, "/interview", "/system-design", "/paths", "/leaderboard", "/analytics", "/settings", `/profile/${username}`];
if (problemId) routes.push(`/problems/${problemId}`);
if (pathSlug) routes.push(`/paths/${pathSlug}`);

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

async function observe(page, label) {
  const observation = await page.evaluate(() => {
    const clipped = [...document.querySelectorAll("button, a, input, textarea, [role=tab]")].filter((element) => {
      if (element.closest("[data-heatmap-scroll]")) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.top < innerHeight && rect.bottom > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
    }).map((element) => (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80));
    return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, clipped, nestedInteractive: document.querySelectorAll("a button, button a").length, infiniteAnimations: document.getAnimations().filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity).length };
  });
  if (observation.documentWidth > observation.viewport + 1 || observation.clipped.length || observation.nestedInteractive) throw new Error(`${label}: ${JSON.stringify(observation)}`);
  return observation;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(output, name), animations: "disabled" });
  report.screenshots.push(name);
}

try {
  for (const theme of ["dark", "light"]) {
    for (const width of [390, 768, 1440]) {
      const context = await contextFor(theme, width);
      const page = await context.newPage();
      track(page, `${theme}-${width}`);
      for (const route of routes) {
        const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
        await page.locator("h1").first().waitFor();
        await page.waitForTimeout(150);
        const label = `${route}-${theme}-${width}`;
        const observation = await observe(page, label);
        const headings = await page.locator("h1").allTextContents();
        report.routes.push({ route, theme, width, status: response?.status(), headings, ...observation });
        if (response?.status() !== 200 || !headings.length) throw new Error(`${label}: HTTP ${response?.status()}, headings ${headings}`);
        if (width !== 768 && ["/leaderboard", "/settings", `/profile/${username}`].includes(route)) await shot(page, `${route.split("/")[1]}-${theme}-${width}.png`);
      }
      await context.close();
    }
  }

  for (const width of [390, 1440]) {
    const guest = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await guest.newPage();
    track(page, `guest-${width}`);
    for (const route of ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]) {
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      await page.locator("h1").first().waitFor();
      const observation = await observe(page, `guest-${route}-${width}`);
      const headings = await page.locator("h1").allTextContents();
      report.routes.push({ route, theme: "guest", width, status: response?.status(), headings, ...observation });
      if (response?.status() !== 200 || !headings.length) throw new Error(`guest ${route}: HTTP ${response?.status()}, headings ${headings}`);
    }
    await guest.close();
  }

  const context = await contextFor("light", 390, "reduce");
  const page = await context.newPage();
  track(page, "recovery");
  let leaderboardFails = true;
  await context.route(/\/api\/leaderboard(?:\?|$)/, (route) => leaderboardFails ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Ranking service unavailable" }) }) : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leaderboard: [], total: 0, page: 1, limit: 20 }) }));
  await page.goto(`${base}/leaderboard`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Rankings unavailable" }).waitFor();
  await shot(page, "leaderboard-error-light-390.png");
  leaderboardFails = false;
  await page.getByRole("button", { name: "Retry rankings" }).click();
  await page.getByRole("heading", { name: "No ranked submissions yet" }).waitFor();
  report.states.push({ state: "leaderboard-error-to-empty", ...await observe(page, "leaderboard recovery") });
  await page.goto(`${base}/profile/phase7_missing_user`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Profile not found" }).waitFor();
  await shot(page, "profile-missing-light-390.png");
  report.states.push({ state: "missing-profile", ...await observe(page, "missing profile") });
  await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Update password" }).click();
  await page.getByText("Current password is required").waitFor();
  report.states.push({ state: "settings-validation", ...await observe(page, "settings validation") });
  await shot(page, "settings-validation-light-390.png");
  if ((await observe(page, "reduced-motion")).infiniteAnimations !== 0) throw new Error("Reduced-motion animation remained active");
  await context.close();

  const zoomContext = await contextFor("light", 360);
  const zoomPage = await zoomContext.newPage();
  track(zoomPage, "zoom-keyboard");
  await zoomPage.goto(`${base}/leaderboard`, { waitUntil: "networkidle" });
  report.states.push({ state: "200-percent-reflow-proxy", ...await observe(zoomPage, "zoom leaderboard") });
  await zoomPage.goto(`${base}/settings`, { waitUntil: "networkidle" });
  await zoomPage.getByLabel("Current password").focus();
  await zoomPage.keyboard.type("keyboard");
  if (await zoomPage.getByLabel("Current password").inputValue() !== "keyboard") throw new Error("Keyboard input failed");
  report.states.push({ state: "keyboard-settings", ...await observe(zoomPage, "zoom settings") });
  await shot(zoomPage, "settings-zoom-200-light-720.png");
  await zoomContext.close();
} finally {
  await fs.writeFile(path.join(output, "browser-phase7.json"), `${JSON.stringify(report, null, 2)}\n`);
  const hashes = await Promise.all(report.screenshots.map(async (name) => `${crypto.createHash("sha256").update(await fs.readFile(path.join(output, name))).digest("hex")}  ${name}`));
  await fs.writeFile(path.join(output, "screenshot-sha256.txt"), `${hashes.sort().join("\n")}\n`);
  await setup.close();
  await browser.close();
}

console.log(JSON.stringify({ routes: report.routes.length, states: report.states.length, screenshots: report.screenshots.length, pageErrors: report.pageErrors, requestFailures: report.requestFailures }, null, 2));
if (report.pageErrors.length || report.requestFailures.length) process.exitCode = 1;
