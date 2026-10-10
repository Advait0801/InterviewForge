// Run from the repository root with PLAYWRIGHT_MODULE pointing to an installed Playwright module.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = "http://localhost:3002";
const sessionId = "00000000-0000-4000-8000-000000000001";
const opening = { question: "Describe a difficult trade-off.", reasoningFocus: "trade-offs", expectedCompetencies: [], groundedIn: null, retrievalHits: 0, context: "", retrievalConfidence: null, liveIngestion: null, resumeGrounded: false, resumeHits: 0, resumeEvidence: [] };
const text = "I clarified the constraints and compared latency, consistency, and reliability. ".repeat(8);
const messages = Array.from({ length: 40 }, (_, index) => ({
  id: `m${index}`, session_id: sessionId, role: index % 2 === 0 ? "assistant" : "candidate", stage: "behavioral",
  content: index % 2 === 0 ? `${opening.question} Round ${index / 2 + 1}.` : text,
  metadata_json: index % 2 === 0 ? { kind: "question", ...opening, company: "google", stage: "behavioral" } : { kind: "answer" },
  created_at: "2026-01-01T00:00:00Z",
}));
const results = { browser: browser.version(), observations: [], pageErrors: [], consoleErrors: [] };
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: "if-token", value: "fixture-token" }, { name: "if-theme", value: theme }] }] } });
    await context.route(/\/api\//, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const json = (body) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
      if (pathname.endsWith("/users/me")) return json({ user: { id: "qa", username: "qa", name: "QA", avatar_url: null } });
      if (pathname.endsWith("/interviews/stream")) return route.fulfill({ contentType: "text/event-stream", body: `event: done\ndata: ${JSON.stringify({ type: "done", result: { session: { id: sessionId, company: "google", currentStage: "behavioral", status: "active", persona: "neutral", mode: "fixed" }, openingQuestion: opening } })}\n\n` });
      if (pathname.endsWith(`/interviews/${sessionId}`)) return json({ session: { id: sessionId, company: "google", current_stage: "behavioral", status: "active", persona: "neutral", mode: "fixed", report_json: null }, messages });
      throw new Error(`Unexpected request ${pathname}`);
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => results.pageErrors.push(error.message));
    page.on("console", (event) => { if (event.type() === "error") results.consoleErrors.push(event.text()); });
    await page.goto(`${base}/interview`);
    await page.getByRole("button", { name: "Start interview", exact: true }).click();
    await page.getByRole("textbox", { name: "Your answer" }).waitFor();
    const region = page.getByRole("region", { name: "Interview conversation", exact: true });
    const dimensions = await region.evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, tabIndex: element.tabIndex }));
    assert.ok(dimensions.scrollHeight > dimensions.clientHeight, "Fixture transcript must overflow");
    assert.equal(dimensions.tabIndex, 0);
    // Reach the region through actual Tab navigation, then scroll it using the keyboard.
    await page.evaluate(() => document.activeElement?.blur());
    let reached = false;
    for (let count = 0; count < 50; count++) {
      await page.keyboard.press("Tab");
      if (await region.evaluate((element) => element === document.activeElement)) { reached = true; break; }
    }
    assert.equal(reached, true, "Conversation is reachable using Tab");
    const focusStyle = await region.evaluate((element) => { const style = getComputedStyle(element); return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, focusVisible: element.matches(":focus-visible") }; });
    assert.equal(focusStyle.focusVisible, true);
    assert.notEqual(focusStyle.outlineStyle, "none");
    assert.ok(parseFloat(focusStyle.outlineWidth) > 0);
    await region.evaluate((element) => { element.scrollTop = 0; });
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(() => document.querySelector('[role="region"][aria-label="Interview conversation"]').scrollTop > 0);
    await page.addScriptTag({ path: path.resolve("web/node_modules/axe-core/axe.min.js") });
    const axe = await page.evaluate(async () => {
      const result = await window.axe.run();
      return { serious: result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact)).map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) })), scrollableRegionPassed: result.passes.some((rule) => rule.id === "scrollable-region-focusable"), allViolations: result.violations.map((violation) => ({ id: violation.id, impact: violation.impact })) };
    });
    results.observations.push({ theme, messages: messages.length, ...dimensions, focusStyle, keyboardScrolled: true, ...axe });
    assert.deepEqual(axe.serious, []);
    assert.equal(axe.scrollableRegionPassed, true);
    await context.close();
  }
  assert.deepEqual(results.pageErrors, []);
  assert.deepEqual(results.consoleErrors, []);
  results.passed = true;
} catch (error) {
  results.passed = false; results.failure = error.message; process.exitCode = 1;
} finally {
  await fs.writeFile(new URL("followup-axe.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}
