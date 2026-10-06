// axe audit of the main pages against the live dev stack (web :3002, API :4000), both themes.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { default: AxeBuilder } = await import(process.env.AXE_MODULE || '@axe-core/playwright');
import fs from 'node:fs';

const WEB = 'http://localhost:3002', API = 'http://localhost:4000/api';
const stamp = Date.now();
const reg = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: `axe${stamp}`, email: `axe${stamp}@example.invalid`, password: `AxeAudit-${stamp}!`, fullName: 'Axe Audit' }) });
const { token } = await reg.json();
if (!token) throw new Error('register failed ' + reg.status);
const problems = await (await fetch(`${API}/problems?limit=1`)).json();
const problemId = (problems.problems || problems.data || problems)[0]?.id;
const paths = await (await fetch(`${API}/learning-paths`)).json().catch(() => null);
const slug = (paths?.paths || paths || [])[0]?.slug;

const guest = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/leaderboard', `/profile/axe${stamp}`];
const authed = ['/dashboard', '/problems', problemId && `/problems/${problemId}`, '/interview', '/system-design', '/assessments', '/paths', slug && `/paths/${slug}`, '/analytics', '/settings'].filter(Boolean);

const browser = await chromium.launch();
const results = [];
for (const theme of ['dark', 'light']) {
  for (const [routes, auth] of [[guest, false], [authed, true]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(([t, tok, th]) => { localStorage.setItem('if-theme', th); if (tok) localStorage.setItem('if-token', t); }, [token, auth, theme]);
    const page = await ctx.newPage();
    for (const route of routes) {
      await page.goto(WEB + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(900); // let entrance animations settle so contrast is measured at rest
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      for (const v of r.violations) results.push({ theme, route, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
        targets: v.nodes.slice(0, 4).map(n => n.target.join(' ')),
        details: v.nodes.map(n => ({ t: n.target.join(' '), html: n.html.slice(0, 140), data: (n.any[0] || {}).data })), summary: v.nodes[0]?.failureSummary?.split('\n').slice(0, 3).join(' ') });
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(process.env.OUT, JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const byRule = {};
for (const x of results) { const k = `${x.impact}|${x.id}`; (byRule[k] ||= { impact: x.impact, id: x.id, help: x.help, routes: new Set(), nodes: 0 }); byRule[k].routes.add(`${x.route}(${x.theme[0]})`); byRule[k].nodes += x.nodes; }
for (const v of Object.values(byRule).sort((a, b) => order[a.impact] - order[b.impact]))
  console.log(`${v.impact.padEnd(9)} ${v.id.padEnd(28)} nodes=${String(v.nodes).padStart(3)}  ${[...v.routes].join(' ')}`);
