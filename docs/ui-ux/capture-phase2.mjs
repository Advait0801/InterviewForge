// Phase 2 browser verification. Uses disposable local accounts and the real local auth API.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.UI_BASE_URL || "http://localhost:3002";
const api = process.env.UI_API_URL || "http://localhost:4000/api";
const output = path.resolve(process.env.UI_EVIDENCE_DIR || "docs/ui-ux/evidence/phase-2");
const browser = await chromium.launch({ channel: "chrome", headless: true });
await fs.mkdir(output, { recursive: true });

const report = {
  base,
  browser: browser.version(),
  observations: [],
  screenshots: [],
  consoleErrors: [],
  expectedConsoleErrors: [],
  pageErrors: [],
  notes: [
    "All accounts, credentials, verification tokens, and reset tokens are disposable local QA data.",
    "A real registration, email-verification redirect, password-reset link, password update, and sign-in were exercised.",
    "No paid AI routes were called. Recommendation requests use an empty deterministic fixture.",
    "The 720 CSS-pixel viewport represents the reflow space of a 1440-pixel window at 200% zoom.",
  ],
};

const requestContext = await browser.newContext();
const baselineUsername = `uiqa_phase2_${crypto.randomBytes(4).toString("hex")}`;
const baselinePassword = crypto.randomBytes(18).toString("base64url");
const baselineRegistration = await requestContext.request.post(`${api}/auth/register`, {
  data: { username: baselineUsername, password: baselinePassword, email: `${baselineUsername}@example.invalid`, fullName: "UI Phase Two" },
});
if (baselineRegistration.status() !== 201) throw new Error(`Baseline registration failed: ${baselineRegistration.status()}`);
const { token: baselineToken } = await baselineRegistration.json();

async function contextFor({ theme = "dark", authed = false, width = 1440, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion,
    storageState: {
      cookies: [],
      origins: [{
        origin: new URL(base).origin,
        localStorage: [
          { name: "if-theme", value: theme },
          ...(authed ? [{ name: "if-token", value: baselineToken }] : []),
        ],
      }],
    },
  });
  await context.route("**/api/recommendations", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ recommended: [], revisit: [], focusAreas: [], reasoning: "Phase 2 fixture", difficultySuggestion: "easy" }),
  }));
  await context.addInitScript(() => {
    window.__phase2LayoutShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__phase2LayoutShifts.push(entry.value);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  return context;
}

function observePage(page, label, expectedStatusError = false) {
  page.on("pageerror", (error) => report.pageErrors.push({ label, message: error.message }));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const item = { label, message: message.text() };
    if (expectedStatusError && /Failed to load resource/.test(item.message)) report.expectedConsoleErrors.push(item);
    else report.consoleErrors.push(item);
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
    const clippedControls = [...document.querySelectorAll("a, button, input")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return visible(element) && rect.top < innerHeight && rect.bottom > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
    }).map((element) => ({ tag: element.tagName, text: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80) }));
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      clippedControls,
      nestedInteractive: document.querySelectorAll("a button, button a").length,
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      h1: document.querySelector("h1")?.textContent?.trim() || null,
      layoutShiftSum: (window.__phase2LayoutShifts || []).reduce((sum, value) => sum + value, 0),
    };
  });
  report.observations.push({ label, route, finalRoute: new URL(page.url()).pathname, ...observation });
  return observation;
}

async function visit({ route, label, theme, authed = false, width, screenshot = true }) {
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

function tokenFromBackendLog(email, kind) {
  const logs = execFileSync("docker", ["compose", "logs", "--no-color", "--tail", "500", "backend"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const marker = kind === "verify" ? "verify-email?token=" : "reset-password?token=";
  const line = logs.split("\n").reverse().find((candidate) => candidate.includes(email) && candidate.includes(marker));
  if (!line) throw new Error(`Could not find synthetic ${kind} link in backend logs`);
  const raw = line.split(marker)[1]?.trim();
  if (!raw) throw new Error(`Synthetic ${kind} token was missing from backend logs`);
  return decodeURIComponent(raw);
}

function contrastRatio(first, second) {
  const luminance = (hex) => {
    const rgb = hex.replace("#", "").match(/.{2}/g).map((part) => parseInt(part, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const [bright, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return Number(((bright + 0.05) / (dark + 0.05)).toFixed(2));
}

try {
  for (const theme of ["dark", "light"]) {
    for (const width of [320, 390, 720, 768, 1024, 1440]) {
      await visit({ route: "/", label: `home-signed-out-${theme}-${width}`, theme, width, screenshot: [320, 720, 1440].includes(width) });
    }
  }
  for (const [theme, width] of [["dark", 390], ["dark", 1440], ["light", 1440]]) {
    await visit({ route: "/", label: `home-signed-in-${theme}-${width}`, theme, width, authed: true });
  }

  const authRoutes = [
    ["/login", "login"], ["/register", "register"], ["/forgot-password", "forgot-password"],
    ["/reset-password", "reset-password-missing"], ["/verify-email", "verify-email-default"],
    ["/verify-email?verified=1", "verify-email-success"], ["/verify-email?error=invalid", "verify-email-invalid"],
  ];
  for (const theme of ["dark", "light"]) {
    for (const [route, name] of authRoutes) await visit({ route, label: `${name}-${theme}-1440`, theme, width: 1440 });
  }
  for (const [route, name] of authRoutes) await visit({ route, label: `${name}-dark-390`, theme: "dark", width: 390 });

  const homeContext = await contextFor({ theme: "light", width: 1440 });
  const homePage = await homeContext.newPage();
  observePage(homePage, "home-semantics");
  await homePage.goto(base, { waitUntil: "networkidle" });
  const primaryCta = homePage.getByRole("link", { name: "Start practicing free" });
  report.home = {
    signedOutPrimaryHref: await primaryCta.getAttribute("href"),
    signInHref: await homePage.getByRole("link", { name: "Sign in", exact: true }).getAttribute("href"),
    nestedInteractive: await homePage.locator("a button, button a").count(),
    primaryCtaInFirstViewport: await primaryCta.evaluate((element) => element.getBoundingClientRect().bottom <= innerHeight),
    previewCaptionVisible: await homePage.getByText(/Illustrative workspace preview/).isVisible(),
  };
  await homeContext.close();

  const signedIn = await contextFor({ theme: "dark", width: 1440, authed: true });
  const signedInPage = await signedIn.newPage();
  observePage(signedInPage, "home-signed-in-reload");
  await signedInPage.goto(base, { waitUntil: "networkidle" });
  await signedInPage.reload({ waitUntil: "networkidle" });
  report.homeSignedIn = {
    dashboardHref: await signedInPage.getByRole("link", { name: "Open dashboard" }).getAttribute("href"),
    hydrationErrors: report.consoleErrors.filter((entry) => entry.label === "home-signed-in-reload" && /hydration|hydrated/i.test(entry.message)).length,
  };
  await signedIn.close();

  const loginContext = await contextFor({ theme: "dark", width: 390 });
  let loginRequests = 0;
  await loginContext.route("**/api/auth/login", async (route) => {
    loginRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Invalid credentials" }) });
  });
  const loginPage = await loginContext.newPage();
  observePage(loginPage, "login-failure", true);
  await loginPage.goto(`${base}/login`, { waitUntil: "networkidle" });
  await loginPage.getByRole("button", { name: "Sign in" }).click();
  const invalidFocus = await loginPage.getByLabel("Email or username").evaluate((element) => element === document.activeElement);
  await loginPage.getByLabel("Email or username").fill("missing-user");
  await loginPage.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await loginPage.getByRole("button", { name: "Sign in" }).click();
  const busy = await loginPage.getByRole("button", { name: "Signing in…" }).getAttribute("aria-busy");
  const disabled = await loginPage.getByRole("button", { name: "Signing in…" }).isDisabled();
  await loginPage.getByRole("alert").waitFor();
  report.login = { invalidFocus, pendingAriaBusy: busy, pendingDisabled: disabled, requests: loginRequests, error: await loginPage.locator('form [role="alert"]').textContent() };
  await loginContext.close();

  const flowUsername = `uiqa2_${crypto.randomBytes(3).toString("hex")}`;
  const flowEmail = `${flowUsername}@example.invalid`;
  const flowPassword = crypto.randomBytes(12).toString("base64url");
  const newPassword = crypto.randomBytes(13).toString("base64url");
  const flowContext = await contextFor({ theme: "light", width: 1024 });
  const flowPage = await flowContext.newPage();
  observePage(flowPage, "real-onboarding-flow");
  await flowPage.goto(`${base}/register`, { waitUntil: "networkidle" });
  await flowPage.getByLabel("Username").fill(flowUsername);
  await flowPage.getByLabel("Email address").fill(flowEmail);
  await flowPage.getByLabel("Password", { exact: true }).fill(flowPassword);
  await flowPage.getByLabel("Full name").fill("Onboarding QA");
  await flowPage.getByRole("button", { name: "Create account" }).click();
  await flowPage.waitForURL("**/dashboard");
  const storedAfterRegister = await flowPage.evaluate(() => Boolean(localStorage.getItem("if-token")));

  const verifyToken = tokenFromBackendLog(flowEmail, "verify");
  await flowPage.evaluate(() => localStorage.removeItem("if-token"));
  await flowPage.goto(`${base}/verify-email?token=${encodeURIComponent(verifyToken)}`);
  await flowPage.waitForURL("**/verify-email?verified=1");
  await flowPage.getByText("Email verified", { exact: true }).waitFor();

  await flowPage.goto(`${base}/forgot-password`, { waitUntil: "networkidle" });
  await flowPage.getByLabel("Email address").fill(flowEmail);
  await flowPage.getByRole("button", { name: "Send reset instructions" }).click();
  await flowPage.getByText("Request received", { exact: true }).waitFor();
  const resetToken = tokenFromBackendLog(flowEmail, "reset");
  await flowPage.goto(`${base}/reset-password?token=${encodeURIComponent(resetToken)}`, { waitUntil: "networkidle" });
  await flowPage.getByLabel("New password", { exact: true }).fill(newPassword);
  await flowPage.getByLabel("Confirm new password").fill(newPassword);
  await flowPage.getByRole("button", { name: "Update password" }).click();
  await flowPage.waitForURL("**/login");
  await flowPage.getByLabel("Email or username").fill(flowUsername);
  await flowPage.getByLabel("Password", { exact: true }).fill(newPassword);
  await flowPage.getByRole("button", { name: "Sign in" }).click();
  await flowPage.waitForURL("**/dashboard");
  report.realFlow = {
    registeredAndStoredToken: storedAfterRegister,
    verifiedRedirect: true,
    recoveryConfirmation: true,
    resetRedirect: true,
    newPasswordLogin: true,
  };
  await flowContext.close();

  report.contrast = {};
  for (const theme of ["light", "dark"]) {
    const contrastContext = await contextFor({ theme, width: 1440 });
    const page = await contrastContext.newPage();
    observePage(page, `contrast-${theme}`);
    await page.goto(base, { waitUntil: "networkidle" });
    const colors = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const value = (name) => styles.getPropertyValue(name).trim();
      return { background: value("--background"), primary: value("--primary"), secondary: value("--secondary"), accent: value("--accent"), error: value("--error"), actionStart: value("--action-start"), actionEnd: value("--action-end") };
    });
    report.contrast[theme] = {
      colors,
      primaryText: contrastRatio(colors.primary, colors.background),
      secondaryText: contrastRatio(colors.secondary, colors.background),
      accentText: contrastRatio(colors.accent, colors.background),
      errorText: contrastRatio(colors.error, colors.background),
      whiteOnActionStart: contrastRatio("#ffffff", colors.actionStart),
      whiteOnActionEnd: contrastRatio("#ffffff", colors.actionEnd),
    };
    await contrastContext.close();
  }

  const reducedContext = await contextFor({ theme: "dark", width: 390, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  observePage(reducedPage, "reduced-motion");
  await reducedPage.goto(base, { waitUntil: "networkidle" });
  report.reducedMotion = await reducedPage.evaluate(() => ({
    preference: matchMedia("(prefers-reduced-motion: reduce)").matches,
    activeInfinite: document.getAnimations().filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity).length,
    previewVisible: Boolean(document.querySelector('[aria-label="Code editor preview"]')),
  }));
  await reducedContext.close();
} finally {
  await requestContext.close();
  const dedupe = (items) => [...new Map(items.map((item) => [`${item.label}:${item.message}`, item])).values()];
  report.consoleErrors = dedupe(report.consoleErrors);
  report.expectedConsoleErrors = dedupe(report.expectedConsoleErrors);
  report.pageErrors = dedupe(report.pageErrors);
  await fs.writeFile(path.join(output, "browser-phase2.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(JSON.stringify({
  observations: report.observations.length,
  screenshots: report.screenshots.length,
  overflowCount: report.observations.filter((item) => item.horizontalOverflow).length,
  clippedControlCount: report.observations.reduce((sum, item) => sum + item.clippedControls.length, 0),
  nestedInteractiveCount: report.observations.reduce((sum, item) => sum + item.nestedInteractive, 0),
  consoleErrors: report.consoleErrors,
  expectedConsoleErrors: report.expectedConsoleErrors,
  pageErrors: report.pageErrors,
  home: report.home,
  homeSignedIn: report.homeSignedIn,
  login: report.login,
  realFlow: report.realFlow,
  contrast: report.contrast,
  reducedMotion: report.reducedMotion,
}, null, 2));
