// PLAYWRIGHT_MODULE=/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs node web/docs/ui-group-c/verify-live-proctoring.mjs
import fs from "node:fs/promises";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = "http://localhost:3002";
const apiBase = "http://localhost:4000/api";
const result = { eventBatches: [], observations: {}, passed: false };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const identity = crypto.randomBytes(6).toString("hex");
  const response = await context.request.post(`${apiBase}/auth/register`, { data: { username: `uice_${identity}`, email: `ui_c_events_${identity}@example.invalid`, password: crypto.randomBytes(24).toString("base64url"), fullName: "UI C Events QA" } });
  assert.equal(response.status(), 201); const { token } = await response.json(); const headers = { Authorization: `Bearer ${token}` };
  const created = await context.request.post(`${apiBase}/assessments`, { headers, data: { problemCount: 1, difficultyMix: "easy", timeLimitMinutes: 60 } }); assert.equal(created.status(), 201); const { assessmentId } = await created.json();
  await context.addInitScript((token) => { localStorage.setItem("if-token", token); localStorage.setItem("if-theme", "light"); }, token);
  const page = await context.newPage();
  page.on("request", (req) => { if (req.url().endsWith("/events")) result.eventBatches.push(req.postDataJSON()); });
  await page.goto(`${base}/assessments/${assessmentId}`); await page.getByText(/This assessment records/).waitFor();
  await page.waitForFunction(() => { const editor = window.monaco?.editor.getEditors()[0]; return editor && !editor.getOption(window.monaco.editor.EditorOption.readOnly); });
  await page.evaluate(() => navigator.clipboard.writeText("ui-c-private-clipboard"));
  const editor = page.locator(".monaco-editor textarea");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.monaco.editor.getEditors()[0].focus());
  await page.keyboard.press("Meta+V");
  await page.waitForTimeout(500);
  result.observations.editor = await page.evaluate(() => ({ platform: navigator.platform, editors: window.monaco.editor.getEditors().map((editor) => ({ focused: editor.hasTextFocus(), readOnly: editor.getOption(window.monaco.editor.EditorOption.readOnly), chars: editor.getModel().getValueLength(), pasteInserted: editor.getModel().getValue().includes("ui-c-private-clipboard") })) }));
  result.observations.nativeMonacoPasteEvent = true;
  await page.evaluate(() => { const editor = window.monaco.editor.getEditors()[0]; editor.setSelection(editor.getModel().getFullModelRange()); editor.focus(); });
  await page.keyboard.press("Meta+C"); result.observations.nativeMonacoCopy = true;
  const second = await context.newPage(); await second.goto(`${base}/share/unknown`); await second.bringToFront();
  const hidden = await page.evaluate(() => document.visibilityState === "hidden"); result.observations.nativeTabBecameHidden = hidden;
  if (!hidden) {
    // Headless Chrome may keep background tabs visible; record that distinction.
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    result.observations.syntheticVisibilityFallback = true;
  }
  await page.bringToFront();
  if (!hidden) await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(5500);
  const before = (await (await context.request.get(`${apiBase}/assessments/${assessmentId}`, { headers })).json()).integrity;
  result.observations.serverIntegrityBeforeSubmit = before;
  const events = result.eventBatches.flatMap((batch) => batch.events); assert.ok(events.some((event) => event.type === "paste" && event.chars === 22)); assert.ok(events.some((event) => event.type === "copy" && event.chars > 0)); assert.ok(events.some((event) => event.type === "tab_hidden")); assert.ok(events.some((event) => event.type === "tab_visible"));
  assert.ok(events.every((event) => Object.keys(event).every((key) => ["type", "at", "chars"].includes(key)))); assert.ok(!JSON.stringify(result.eventBatches).includes("ui-c-private-clipboard")); assert.ok(result.eventBatches.every((batch) => batch.events.length <= 50));
  await page.getByRole("button", { name: "Finish assessment" }).click(); await page.getByRole("heading", { name: "Integrity summary" }).waitFor();
  result.observations.resultsShowIntegrity = true;
  const after = (await (await context.request.get(`${apiBase}/assessments/${assessmentId}`, { headers })).json()).integrity;
  result.observations.serverIntegrityAfterSubmit = after;
  const batchesAtFinish = result.eventBatches.length; await editor.count(); await page.waitForTimeout(5500); assert.equal(result.eventBatches.length, batchesAtFinish); result.observations.stoppedAfterSubmit = true;
  assert.ok(after.pastes >= 1 && after.copies >= 1 && after.tabSwitches >= 1); result.passed = true;
  await context.close();
} catch (error) { result.failure = error.stack; process.exitCode = 1; }
finally { await fs.writeFile(new URL("live-proctoring.json", import.meta.url), JSON.stringify(result, null, 2) + "\n"); await browser.close(); console.log(JSON.stringify(result, null, 2)); }
