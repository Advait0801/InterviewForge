// Phase 1 browser verification. Uses a disposable local QA account only.
// Install Playwright in a temporary tools directory and pass PLAYWRIGHT_MODULE.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3002";
const api = process.env.UI_API_URL || "http://localhost:4000/api";
const output = path.resolve(process.env.UI_EVIDENCE_DIR || "docs/ui-ux/evidence/phase-1");
const browser = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir(output, { recursive: true });

const report = {
  base,
  browser: browser.version(),
  observations: [],
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  notes: [
    "A disposable local QA account and real local API data were used.",
    "Recommendation requests were replaced by a deterministic 503 to avoid paid AI calls.",
    "The 720 CSS-pixel check represents the reflow space of a 1440-pixel window at 200% zoom.",
  ],
};

const requestContext = await browser.newContext();
const username = `uiqa_phase1_${crypto.randomBytes(4).toString("hex")}`;
const password = crypto.randomBytes(24).toString("base64url");
const registration = await requestContext.request.post(`${api}/auth/register`, {
  data: { username, password, email: `${username}@example.invalid`, fullName: "UI Phase One" },
});
if (registration.status() !== 201) throw new Error(`QA registration failed: ${registration.status()}`);
const { token } = await registration.json();
const headers = { Authorization: `Bearer ${token}` };
const pathsResponse = await requestContext.request.get(`${api}/learning-paths`, { headers });
if (!pathsResponse.ok()) throw new Error(`Learning paths failed: ${pathsResponse.status()}`);
const learningPaths = await pathsResponse.json();
const learningPath = learningPaths.paths[0];
if (!learningPath) throw new Error("No learning path is available for nested-route verification");

async function contextFor({ theme = "dark", authed = true, width = 1440, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion,
    storageState: {
      cookies: [],
      origins: [{
        origin: new URL(base).origin,
        localStorage: [
          { name: "if-theme", value: theme },
          ...(authed ? [{ name: "if-token", value: token }] : []),
        ],
      }],
    },
  });
  await context.route("**/api/recommendations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      recommended: [], revisit: [], focusAreas: [],
      reasoning: "Phase 1 browser fixture", difficultySuggestion: "easy",
    }),
  }));
  return context;
}

function observePage(page, label) {
  page.on("pageerror", (error) => report.pageErrors.push({ label, message: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push({ label, message: message.text() });
  });
}

async function pageObservation(page, label, route) {
  const observation = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const clippedControls = [...document.querySelectorAll("header a, header button, main a, main button, main input, main select")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return visible(element) && rect.top < innerHeight && rect.bottom > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
      })
      .map((element) => ({
        tag: element.tagName,
        text: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80),
      }));
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      clippedControls,
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      h1: document.querySelector("h1")?.textContent?.trim() || null,
    };
  });
  report.observations.push({ label, route, finalRoute: new URL(page.url()).pathname, ...observation });
  return observation;
}

async function visit({ route, label, theme, authed, width, screenshot = false }) {
  const context = await contextFor({ theme, authed, width });
  const page = await context.newPage();
  observePage(page, label);
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await page.locator("body").waitFor();
  await pageObservation(page, label, route);
  if (screenshot) {
    const filename = `${label}.png`;
    await page.screenshot({ path: path.join(output, filename), animations: "disabled" });
    report.screenshots.push(filename);
  }
  await context.close();
}

try {
  // Shared shell across narrow, intermediate, desktop, and 200% reflow-equivalent widths.
  for (const theme of ["dark", "light"]) {
    for (const width of [320, 390, 720, 768, 1024, 1280, 1320, 1440]) {
      for (const [route, name, authed] of [["/", "home", false], ["/dashboard", "dashboard", true]]) {
        await visit({
          route,
          label: `${name}-${theme}-${width}`,
          theme,
          authed,
          width,
          screenshot: [320, 1024, 1440].includes(width),
        });
      }
    }
  }

  // Representative list page checks the shared static Card behavior and nested route navigation.
  for (const [theme, width] of [["dark", 390], ["dark", 1440], ["light", 1440]]) {
    await visit({ route: "/problems", label: `problems-${theme}-${width}`, theme, authed: true, width, screenshot: true });
  }

  const mobile = await contextFor({ theme: "dark", authed: true, width: 390 });
  const mobilePage = await mobile.newPage();
  observePage(mobilePage, "mobile-navigation");
  await mobilePage.goto(`${base}/paths/${learningPath.slug}`, { waitUntil: "networkidle" });
  const menuButton = mobilePage.getByRole("button", { name: "Toggle menu" });
  await menuButton.focus();
  await mobilePage.keyboard.press("Enter");
  const firstMobileLink = mobilePage.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link").first();
  report.mobileNavigation = {
    expanded: await menuButton.getAttribute("aria-expanded"),
    firstLinkFocused: await firstMobileLink.evaluate((element) => element === document.activeElement),
    nestedRouteCurrent: await mobilePage.getByRole("link", { name: "Paths", exact: true }).getAttribute("aria-current"),
    accountSettingsVisible: await mobilePage.getByRole("navigation", { name: "Mobile navigation" })
      .locator('a[href="/settings"]').isVisible(),
  };
  await mobilePage.screenshot({ path: path.join(output, "mobile-menu-dark-390.png"), animations: "disabled" });
  report.screenshots.push("mobile-menu-dark-390.png");
  await mobilePage.keyboard.press("Escape");
  report.mobileNavigation.escapeCloses = (await menuButton.getAttribute("aria-expanded")) === "false";
  report.mobileNavigation.escapeRestoresFocus = await menuButton.evaluate((element) => element === document.activeElement);
  await mobile.close();

  const desktop = await contextFor({ theme: "dark", authed: true, width: 1440 });
  const desktopPage = await desktop.newPage();
  observePage(desktopPage, "desktop-navigation");
  await desktopPage.goto(`${base}/paths/${learningPath.slug}`, { waitUntil: "networkidle" });
  report.desktopNavigation = {
    primaryVisible: await desktopPage.getByRole("navigation", { name: "Primary navigation" }).isVisible(),
    menuButtonVisible: await desktopPage.getByRole("button", { name: "Toggle menu" }).isVisible(),
    nestedRouteCurrent: await desktopPage.getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Paths", exact: true }).getAttribute("aria-current"),
    assessmentsLabelVisible: await desktopPage.getByRole("link", { name: "Assessments", exact: true }).isVisible(),
  };
  await desktop.close();

  const compact = await contextFor({ theme: "dark", authed: true, width: 1280 });
  const compactPage = await compact.newPage();
  observePage(compactPage, "compact-navigation");
  await compactPage.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  report.compactNavigation = {
    primaryVisible: await compactPage.getByRole("navigation", { name: "Primary navigation" }).isVisible(),
    menuButtonVisible: await compactPage.getByRole("button", { name: "Toggle menu" }).isVisible(),
  };
  await compact.close();

  const theming = await contextFor({ theme: "dark", authed: false, width: 390 });
  const themePage = await theming.newPage();
  observePage(themePage, "theme-and-focus");
  await themePage.goto(base, { waitUntil: "networkidle" });
  await themePage.keyboard.press("Tab");
  report.focus = await themePage.evaluate(() => {
    const element = document.activeElement;
    const style = element ? getComputedStyle(element) : null;
    return {
      text: element?.textContent?.trim() || null,
      href: element?.getAttribute("href") || null,
      outlineStyle: style?.outlineStyle || null,
      outlineWidth: style?.outlineWidth || null,
    };
  });
  await themePage.getByRole("button", { name: "Toggle menu" }).click();
  await themePage.getByRole("button", { name: "Switch to light mode" }).click();
  report.theme = {
    stored: await themePage.evaluate(() => localStorage.getItem("if-theme")),
    colorScheme: await themePage.evaluate(() => document.documentElement.style.colorScheme),
  };
  await themePage.reload({ waitUntil: "networkidle" });
  report.theme.persistsAfterReload = await themePage.evaluate(() => !document.documentElement.classList.contains("dark"));
  await theming.close();

  const reduced = await contextFor({ theme: "dark", authed: false, width: 390, reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  observePage(reducedPage, "reduced-motion");
  await reducedPage.goto(base, { waitUntil: "networkidle" });
  report.reducedMotion = await reducedPage.evaluate(() => {
    const decorative = document.querySelector(".animate-blob");
    return {
      preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
      activeInfinite: document.getAnimations().filter((animation) =>
        animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity).length,
      decorativeIterationCount: decorative ? getComputedStyle(decorative).animationIterationCount : null,
    };
  });
  await reduced.close();

  // Direct protected-route loads specifically cover the Phase 0 hydration defect.
  const hydration = await contextFor({ theme: "dark", authed: true, width: 1440 });
  const hydrationPage = await hydration.newPage();
  observePage(hydrationPage, "authenticated-reload");
  for (const route of ["/dashboard", "/problems"]) {
    await hydrationPage.goto(`${base}${route}`, { waitUntil: "networkidle" });
    await hydrationPage.reload({ waitUntil: "networkidle" });
  }
  report.authenticatedReload = {
    finalRoute: new URL(hydrationPage.url()).pathname,
    hydrationConsoleErrors: report.consoleErrors.filter((entry) =>
      entry.label === "authenticated-reload" && /hydration|hydrated/i.test(entry.message)).length,
    accountSettingsVisible: await hydrationPage.getByRole("link", { name: "Account settings" }).isVisible(),
  };
  await hydration.close();
} finally {
  await requestContext.close();
  const uniqueConsoleErrors = new Map();
  for (const error of report.consoleErrors) {
    const key = `${error.label}:${error.message}`;
    uniqueConsoleErrors.set(key, { ...error, count: (uniqueConsoleErrors.get(key)?.count || 0) + 1 });
  }
  report.consoleErrors = [...uniqueConsoleErrors.values()];
  await fs.writeFile(path.join(output, "browser-phase1.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(JSON.stringify({
  screenshots: report.screenshots.length,
  observations: report.observations.length,
  overflowCount: report.observations.filter((item) => item.horizontalOverflow).length,
  clippedControlCount: report.observations.reduce((sum, item) => sum + item.clippedControls.length, 0),
  pageErrors: report.pageErrors.length,
  consoleErrors: report.consoleErrors,
  mobileNavigation: report.mobileNavigation,
  desktopNavigation: report.desktopNavigation,
  compactNavigation: report.compactNavigation,
  theme: report.theme,
  focus: report.focus,
  reducedMotion: report.reducedMotion,
  authenticatedReload: report.authenticatedReload,
}, null, 2));
