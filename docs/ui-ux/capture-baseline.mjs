// Phase 0 browser audit. Uses a disposable local QA account, never a personal session.
// Install Playwright in a temporary tools directory and pass PLAYWRIGHT_MODULE.
// Requires local web/API services; PROD_URL optionally points to an isolated build.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.UI_BASE_URL || 'http://localhost:3002';
const api = process.env.UI_API_URL || 'http://localhost:4000/api';
const output = path.resolve(process.env.UI_EVIDENCE_DIR || 'docs/ui-ux/evidence/phase-0');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await fs.mkdir(output, { recursive: true });
const report = { base, browser: browser.version(), screenshots: [], observations: [], pageErrors: [], notes: [
  'Screenshots settle finite animations using Playwright animations:disabled.',
  'Recommendation requests are replaced by a deterministic 503 to avoid paid AI calls.',
  'QA account, assessment, and profile are synthetic; catalogue and other API data are real local data.',
  'Viewport screenshots are not full-page captures. Route inventory is broader than this baseline sample.',
] };

const requestContext = await browser.newContext();
const username = `uiqa_${crypto.randomBytes(4).toString('hex')}`;
const password = crypto.randomBytes(24).toString('base64url');
const registration = await requestContext.request.post(`${api}/auth/register`, {
  data: { username, password, email: `${username}@example.invalid`, fullName: 'UI Baseline' },
});
if (registration.status() !== 201) throw new Error(`QA registration failed: ${registration.status()}`);
const { token } = await registration.json();
const headers = { Authorization: `Bearer ${token}` };
const catalogue = await (await requestContext.request.get(`${api}/problems`, { headers })).json();
const problem = catalogue.problems.find(p => p.slug === 'two-sum') || catalogue.problems[0];
const paths = await (await requestContext.request.get(`${api}/learning-paths`, { headers })).json();
const assessmentResponse = await requestContext.request.post(`${api}/assessments`, {
  headers, data: { timeLimitMinutes: 120, problemCount: 2, difficultyMix: 'easy' },
});
if (!assessmentResponse.ok()) throw new Error(`QA assessment failed: ${assessmentResponse.status()}`);
const assessment = await assessmentResponse.json();
report.qa = { username, assessmentId: assessment.assessmentId, problemId: problem.id };

async function contextFor(theme, authed = true, width = 1440, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion,
    storageState: { cookies: [], origins: [{ origin: new URL(base).origin, localStorage: [
      { name: 'if-theme', value: theme }, ...(authed ? [{ name: 'if-token', value: token }] : []),
    ] }] },
  });
  await context.route('**/api/recommendations', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'UI baseline: recommendations unavailable' }),
  }));
  context.on('page', page => page.on('pageerror', error => report.pageErrors.push({ route: page.url().replace(base, ''), message: error.message })));
  return context;
}

async function capture(page, route, name) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.locator('body').waitFor();
  // Recharts uses JavaScript animation; screenshot animations:disabled alone
  // does not finish it. Allow its default 1500 ms animation to settle.
  if (name.startsWith('analytics-populated-fixture-')) await page.waitForTimeout(2000);
  const observation = await page.evaluate(() => {
    const width = window.innerWidth;
    const clipped = [...document.querySelectorAll('header a, header button, h1, input, select, button')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && r.top < innerHeight && r.bottom > 0 && (r.left < -1 || r.right > width + 1);
    }).map(el => ({ tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 70) }));
    return { width, title: document.title, headings: [...document.querySelectorAll('h1')].map(el => el.textContent),
      documentWidth: document.documentElement.scrollWidth, clippedControls: clipped,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' };
  });
  report.observations.push({ name, route, finalRoute: page.url().replace(base, ''), ...observation });
  await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });
  report.screenshots.push(`${name}.png`);
}

try {
  // Shared-layout samples across every planned breakpoint, both themes, public/authenticated.
  for (const theme of ['dark', 'light']) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      for (const [route, name, authed] of [['/', 'home', false], ['/dashboard', 'dashboard', true]]) {
        const context = await contextFor(theme, authed, width);
        const page = await context.newPage();
        await capture(page, route, `${name}-${theme}-${width}`);
        await context.close();
      }
    }
  }
  const routes = [
    ['/login', 'login'], ['/register', 'register'], ['/forgot-password', 'forgot-password'],
    ['/reset-password', 'reset-password-missing-token'], ['/verify-email', 'verify-email'],
    ['/problems', 'problems'], [`/problems/${problem.id}`, 'problem-workspace'],
    ['/paths', 'paths'], ...(paths.paths[0] ? [[`/paths/${paths.paths[0].slug}`, 'path-detail']] : []),
    ['/analytics', 'analytics-empty'], ['/assessments', 'assessments'],
    [`/assessments/${assessment.assessmentId}`, 'assessment-workspace'],
    ['/interview', 'interview-setup'], ['/system-design', 'system-design-setup'],
    ['/settings', 'settings'], [`/profile/${username}`, 'profile'],
  ];
  for (const theme of ['dark', 'light']) {
    const context = await contextFor(theme);
    const page = await context.newPage();
    for (const [route, name] of routes) await capture(page, route, `${name}-${theme}-1440`);
    for (const [route, name] of [[`/problems/${problem.id}`, 'problem-workspace'], [`/assessments/${assessment.assessmentId}`, 'assessment-workspace']]) {
      await page.setViewportSize({ width: 390, height: 900 });
      await capture(page, route, `${name}-${theme}-390`);
    }
    await context.close();
  }
  // Keyboard/menu, theme persistence and protected-route baseline.
  const mobile = await contextFor('dark', false, 390);
  const page = await mobile.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  const menu = page.getByRole('button', { name: 'Toggle menu' });
  await menu.focus(); await page.keyboard.press('Enter');
  const menuOpen = await page.getByRole('link', { name: 'Dashboard', exact: true }).isVisible();
  const expanded = await menu.getAttribute('aria-expanded');
  await page.keyboard.press('Escape');
  report.menu = { keyboardOpens: menuOpen, ariaExpanded: expanded,
    escapeCloses: !(await page.getByRole('link', { name: 'Dashboard', exact: true }).isVisible()) };
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  const storedTheme = await page.evaluate(() => localStorage.getItem('if-theme'));
  report.themeToggle = { storedTheme, classIsLight: await page.evaluate(() => !document.documentElement.classList.contains('dark')) };
  await page.reload({ waitUntil: 'networkidle' });
  report.themeToggle.persistsAfterReload = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
  await page.goto(`${base}/problems`, { waitUntil: 'networkidle' });
  report.signedOutRedirect = new URL(page.url()).pathname;
  await page.getByPlaceholder('Email or username').fill(username);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
  const beforeReload = report.pageErrors.length;
  await page.reload({ waitUntil: 'networkidle' });
  report.realLoginReload = { finalRoute: new URL(page.url()).pathname,
    hydrationError: report.pageErrors.slice(beforeReload).some(e => e.message.includes('Hydration')) };
  await mobile.close();

  const reduced = await contextFor('dark', false, 390, 'reduce');
  const rp = await reduced.newPage();
  await rp.goto(base, { waitUntil: 'networkidle' });
  report.reducedMotion = await rp.evaluate(() => ({ preference: matchMedia('(prefers-reduced-motion: reduce)').matches,
    activeInfinite: document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length }));
  await rp.screenshot({ path: path.join(output, 'home-dark-390-reduced-motion.png'), animations: 'disabled' });
  report.screenshots.push('home-dark-390-reduced-motion.png');
  await reduced.close();

  // Deliberate response failure reproduces the existing misleading analytics empty state.
  const failing = await contextFor('dark');
  await failing.route('**/api/users/analytics', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Baseline simulated failure"}' }));
  const fp = await failing.newPage();
  await capture(fp, '/analytics', 'analytics-error-dark-1440');
  report.analyticsErrorLooksEmpty = await fp.getByText('No data yet. Solve some problems to see your analytics!').isVisible();
  await failing.close();

  // Synthetic populated chart and leaderboard samples avoid exposing other users.
  for (const theme of ['dark', 'light']) {
    const populated = await contextFor(theme);
    await populated.route('**/api/users/analytics', route => route.fulfill({ json: {
      solvedOverTime: [{ day: '2026-09-10', count: 1 }, { day: '2026-09-11', count: 3 }, { day: '2026-09-12', count: 2 }],
      difficultyDistribution: { easy: 3, medium: 2, hard: 1 },
      topicStrengths: [{ topic: 'Arrays', count: 3 }, { topic: 'Graphs', count: 2 }, { topic: 'Strings', count: 1 }],
      acceptanceTrend: [{ week: '2026-09-01', rate: 50 }, { week: '2026-09-08', rate: 75 }],
    } }));
    await populated.route('**/api/leaderboard?*', route => route.fulfill({ json: {
      leaderboard: [{ rank: 1, username, name: 'UI Baseline', avatar_url: null, solved: 6, acceptanceRate: 75 }], total: 1, page: 1, limit: 20,
    } }));
    const pp = await populated.newPage();
    await capture(pp, '/analytics', `analytics-populated-fixture-${theme}-1440`);
    await capture(pp, '/leaderboard', `leaderboard-fixture-${theme}-1440`);
    await populated.close();
  }
  report.notes.push('Populated analytics and leaderboard screenshots use synthetic browser fixtures, not recorded user scores.');

  if (process.env.PROD_URL) {
    const production = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pp = await production.newPage();
    await pp.addInitScript(() => {
      window.__baselineShifts = [];
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__baselineShifts.push(e.value); }).observe({ type: 'layout-shift', buffered: true });
    });
    report.production = { url: process.env.PROD_URL, route: '/', cache: 'one cold then two warm navigations in same context', samples: [] };
    for (let i = 0; i < 3; i++) {
      await pp.goto(process.env.PROD_URL, { waitUntil: 'networkidle' });
      report.production.samples.push(await pp.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0];
        const scripts = performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script');
        return { domContentLoadedMs: n.domContentLoadedEventEnd, loadMs: n.loadEventEnd,
          observedLayoutShiftSum: window.__baselineShifts.reduce((a,b) => a+b,0),
          scriptCount: scripts.length, scriptDecodedBytes: scripts.reduce((s,r) => s+r.decodedBodySize,0) };
      }));
    }
    await production.close();
  }
} finally {
  // Keep one full diagnostic per route/error kind with a count, rather than duplicating stacks.
  const grouped = new Map();
  for (const error of report.pageErrors) {
    const key = `${error.route}:${error.message.split('\n')[0]}`;
    if (grouped.has(key)) grouped.get(key).count++;
    else grouped.set(key, { ...error, count: 1 });
  }
  report.pageErrors = [...grouped.values()];
  await fs.writeFile(path.join(output, 'browser-baseline.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify({ screenshots: report.screenshots.length, observations: report.observations.length,
  pageErrors: report.pageErrors.map(e => ({ route: e.route, count: e.count, message: e.message.split('\n')[0] })), menu: report.menu, reducedMotion: report.reducedMotion,
  analyticsErrorLooksEmpty: report.analyticsErrorLooksEmpty, production: report.production }, null, 2));
