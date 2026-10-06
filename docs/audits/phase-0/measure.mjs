// Same shape as capture-baseline.mjs / phase-7: one context at 1440x900, one cold then two warm
// navigations with waitUntil networkidle. Repeated ROUNDS times, targets interleaved so host
// drift hits both equally. "Warm-load mean" = mean loadMs of the two warm navigations.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';

const targets = JSON.parse(process.env.TARGETS); // {name: url}
const ROUNDS = Number(process.env.ROUNDS || 15);
const browser = await chromium.launch();
const out = { browser: browser.version(), rounds: ROUNDS, results: {}, scripts: {} };
for (const n of Object.keys(targets)) out.results[n] = [];

async function sample(url, keepScripts) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__s = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__s.push(e.value); })
      .observe({ type: 'layout-shift', buffered: true });
  });
  const samples = [];
  let scripts;
  for (let i = 0; i < 3; i++) {
    await page.goto(url, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const s = performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script');
      return { fcp: (performance.getEntriesByName("first-contentful-paint")[0]||{}).startTime, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, cls: window.__s.reduce((a, b) => a + b, 0),
        scriptCount: s.length, scriptBytes: s.reduce((a, r) => a + r.decodedBodySize, 0),
        scripts: s.map(r => ({ name: new URL(r.name).pathname, bytes: r.decodedBodySize, dur: r.duration })) };
    });
    if (keepScripts && i === 2) scripts = r.scripts;
    delete r.scripts;
    samples.push(r);
  }
  await ctx.close();
  return { samples, scripts };
}

for (let round = 0; round < ROUNDS; round++) {
  for (const [name, url] of Object.entries(targets)) {
    const { samples, scripts } = await sample(url, round === 0);
    out.results[name].push(samples);
    if (scripts) out.scripts[name] = scripts;
  }
}
await browser.close();

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
out.summary = {};
for (const [name, rounds] of Object.entries(out.results)) {
  const warm = rounds.map(r => (r[1].load + r[2].load) / 2);
  out.summary[name] = { warmLoadMeanFirstRound: +warm[0].toFixed(1), warmLoadMedian: +median(warm).toFixed(1),
    warmLoadMean: +mean(warm).toFixed(1), warmMin: +Math.min(...warm).toFixed(1), warmMax: +Math.max(...warm).toFixed(1),
    coldLoadMedian: +median(rounds.map(r => r[0].load)).toFixed(1),
    warmFcpMedian: +median(rounds.map(r => (r[1].fcp + r[2].fcp) / 2)).toFixed(1), scriptCount: rounds[0][0].scriptCount, scriptBytes: rounds[0][0].scriptBytes, cls: +rounds[0][0].cls.toFixed(5) };
}
fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ browser: out.browser, summary: out.summary }, null, 2));
