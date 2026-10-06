const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
const TOKEN = process.env.TOKEN; // a disposable account's JWT
const cases = {
  missing: { args: [], perms: ['microphone'] },
  denied: { args: ['--use-fake-device-for-media-stream', '--deny-permission-prompts'] },
  granted: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
};
const out = {};
for (const [name, c] of Object.entries(cases)) {
  const b = await chromium.launch({ channel: 'chromium', args: c.args });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: c.perms || [] });
  await ctx.addInitScript(t => {
    localStorage.setItem('if-token', t);
    window.__tracks = []; window.__gumErr = null;
    const orig = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (orig) navigator.mediaDevices.getUserMedia = async (c) => { try { const s = await orig(c); window.__tracks.push(...s.getTracks()); return s; } catch (e) { window.__gumErr = `${e.name}: ${e.message}`; throw e; } };
  }, TOKEN);
  const p = await ctx.newPage();
  const transcribe = [];
  p.on('response', async r => { if (r.url().includes('/speech/transcribe')) transcribe.push({ status: r.status(), body: await r.text().catch(() => '') }); });
  await p.goto('http://localhost:3002/system-design', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Record Voice' }).click();
  await p.waitForTimeout(name === 'granted' ? 2500 : 800);
  const midState = await p.evaluate(() => ({ stopVisible: !![...document.querySelectorAll('button')].find(b => b.textContent.includes('Stop Recording')) }));
  if (midState.stopVisible) { await p.getByRole('button', { name: 'Stop Recording' }).click(); await p.waitForTimeout(6000); }
  const r = await p.evaluate(() => ({
    gumError: window.__gumErr,
    alert: [...document.querySelectorAll('[role=alert]')].map(e => e.textContent.trim()).filter(Boolean),
    toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(e => e.textContent.trim()),
    liveTracksAfter: window.__tracks.filter(t => t.readyState === 'live').length,
    recordButtonStill: !![...document.querySelectorAll('button')].find(b => b.textContent.includes('Record Voice')),
  }));
  out[name] = { ...midState, ...r, transcribe };
  // Navigating away mid-recording: are the mic tracks released?
  if (name === 'granted') {
    await p.getByRole('button', { name: 'Record Voice' }).click(); await p.waitForTimeout(800);
    await p.evaluate(() => { window.__keep = window.__tracks; });
    await p.getByRole('link', { name: 'Practice' }).first().click(); await p.waitForTimeout(1500);
    out[name].liveTracksAfterClientNav = await p.evaluate(() => (window.__keep || []).filter(t => t.readyState === 'live').length);
  }
  await b.close();
}
console.log(JSON.stringify(out, null, 2));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));
