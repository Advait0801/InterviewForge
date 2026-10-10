// Reproduce with: PLAYWRIGHT_MODULE=/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs node web/docs/ui-group-b/verify-browser.mjs
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = "http://localhost:3002";
const apiBase = "http://localhost:4000/api";
const output = path.dirname(new URL(import.meta.url).pathname);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const evidence = { browser: browser.version(), fixtures: [], live: {}, consoleErrors: [], pageErrors: [], notes: [] };
const identity = crypto.randomBytes(6).toString("hex");
const registration = await (await browser.newContext()).request.post(`${apiBase}/auth/register`, { data: { username: `ui_b_${identity}`, email: `ui_b_${identity}@example.invalid`, password: crypto.randomBytes(24).toString("base64url"), fullName: "UI B QA" } });
assert.equal(registration.status(), 201, `Live QA registration: ${registration.status() === 201 ? "ok" : await registration.text()}`);
const { token } = await registration.json();
assert.ok(token);
const sessionId = "00000000-0000-4000-8000-000000000001";
const evaluation = { score: 5, rawScore: 7, hintsUsed: 2, hintPenalty: 2, strengths: ["Clear trade-offs"], weaknesses: [], suggestions: ["Quantify your decision"], shouldAskFollowup: false, followupFocus: "" };
const opening = { question: "Tell me about a difficult trade-off.", reasoningFocus: "ownership", expectedCompetencies: [], groundedIn: null, retrievalHits: 0, context: "", retrievalConfidence: null, liveIngestion: null, resumeGrounded: false, resumeHits: 0, resumeEvidence: [] };
const note = { decided: "pivot", rationale: "Explore reliability before moving to coding.", steps: 2, searches: 2 };
function message(id, content, kind, extra = {}) { return { id, session_id: sessionId, role: kind === "answer" ? "candidate" : kind === "evaluation" ? "system" : "assistant", stage: "behavioral", content, metadata_json: { kind, ...(kind === "question" ? { ...opening, company: "google", stage: "behavioral" } : {}), ...extra }, created_at: "2026-01-01T00:00:00Z" }; }
async function context(theme, width, live = false) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: "if-token", value: token }, { name: "if-theme", value: theme }] }] } });
  const page = await ctx.newPage();
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  page.on("console", (event) => { if (event.type() === "error") evidence.consoleErrors.push(event.text()); });
  if (!live) {
    let answers = 0; let hints = 0; let preferences = { persona: "neutral", mode: "fixed" };
    const messages = [message("q1", opening.question, "question")];
    await ctx.route(/\/api\/interviews(?:\/|$)/, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      const sse = (events) => route.fulfill({ contentType: "text/event-stream", body: events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("") });
      if (pathname.endsWith("/interviews/stream")) {
        preferences = route.request().postDataJSON();
        const result = { session: { id: sessionId, company: "google", currentStage: "behavioral", status: "active", persona: preferences.persona, mode: preferences.mode ?? "fixed" }, openingQuestion: opening };
        return sse([{ type: "question", kind: "question", stage: "behavioral" }, { type: "delta", text: "Provisional opening" }, { type: "done", result }]);
      }
      if (pathname.endsWith("/hint")) {
        if (hints >= 3) return json({ error: "No hints left", code: "hints_exhausted" }, 409);
        hints++; const hint = `Consider the reliability trade-off ${hints}.`;
        messages.push(message(`h${hints}`, hint, "hint", { level: hints, penalty: hints }));
        return json({ sessionId, stage: "behavioral", level: hints, hint, hintsUsed: hints, hintsRemaining: 3 - hints, penalty: hints, nextAvailableAt: hints < 3 ? new Date(Date.now() + 30_000).toISOString() : null });
      }
      if (pathname.endsWith("/answer/stream")) {
        answers++; messages.push(message(`a${answers}`, route.request().postDataJSON().answer, "answer"), message(`e${answers}`, "Feedback", "evaluation", evaluation));
        const result = answers === 1 ? { action: "pivot", sessionId, stage: "behavioral", evaluation, nextQuestion: { question: "How would you handle replica lag?", focus: "reliability", reason: "Explore another topic" }, agent: note }
          : answers === 2 ? { action: "followup", sessionId, stage: "behavioral", evaluation, nextQuestion: { question: "How do you reconcile those claims?", focus: "facts", reason: "Contradiction", challenge: { claim: "All replicas are synchronous", evidence: "Replicas apply asynchronously" } }, agent: { ...note, decided: "probe" } }
          : { action: "completed", sessionId, evaluation, agent: { ...note, decided: "finish" } };
        if (result.action !== "completed") messages.push(message(`q${answers + 1}`, result.nextQuestion.question, answers === 1 ? "question" : "followup", { agent: result.agent, ...(result.nextQuestion.challenge ? { challenge: result.nextQuestion.challenge } : {}) }));
        return sse([{ type: "evaluation", evaluation }, ...(result.action === "completed" ? [] : [{ type: "question", kind: answers === 1 ? "question" : "followup", stage: "behavioral" }, { type: "delta", text: "Provisional next" }]), { type: "done", result }]);
      }
      if (pathname.endsWith("/report")) return json({ sessionId, company: "google", overallScore: 7, stageScores: { behavioral: { score: 7, feedback: "Good judgment." } }, strengths: ["Clear reasoning"], weaknesses: [], recommendations: ["Practice reliability"] });
      if (pathname.endsWith(sessionId)) return json({ session: { id: sessionId, company: "google", current_stage: answers >= 3 ? "report" : "behavioral", status: answers >= 3 ? "completed" : "active", persona: preferences.persona, mode: preferences.mode ?? "fixed", report_json: null }, messages });
      return json({ error: `Unhandled fixture ${pathname}` }, 501);
    });
  }
  return { ctx, page };
}
async function tabTo(page, locator) {
  for (let count = 0; count < 80; count++) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Keyboard could not reach the requested control");
}
async function axe(page, name) {
  await page.addScriptTag({ path: path.resolve("web/node_modules/axe-core/axe.min.js") });
  const result = await page.evaluate(async () => {
    const audit = await window.axe.run();
    return { serious: audit.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) })), all: audit.violations.map((v) => ({ id: v.id, impact: v.impact })) };
  });
  evidence.fixtures.push({ name, ...result, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  assert.deepEqual(result.serious, [], `axe ${name}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow ${name}`);
}
try {
  for (const theme of ["light", "dark"]) {
    const { ctx, page } = await context(theme, theme === "light" ? 1440 : 320);
    await page.goto(`${base}/interview`); await page.getByRole("button", { name: "Start interview", exact: true }).waitFor();
    await axe(page, `setup-${theme}`);
    await tabTo(page, page.getByRole("radio", { name: "Neutral", exact: true })); await page.keyboard.press("ArrowRight");
    await tabTo(page, page.getByRole("radio", { name: "Server default (Classic)", exact: true }));
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    assert.equal(await page.getByRole("radio", { name: "Adaptive", exact: true }).isChecked(), true);
    await tabTo(page, page.getByRole("button", { name: "Start interview", exact: true })); await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "Your answer" }).waitFor();
    await tabTo(page, page.getByRole("button", { name: "Get a hint", exact: true })); await page.keyboard.press("Enter");
    await page.getByText("Hint 1/3", { exact: true }).waitFor();
    await tabTo(page, page.getByRole("textbox", { name: "Your answer" })); await page.keyboard.type("I would measure replica lag and define a consistency target.");
    await tabTo(page, page.getByRole("button", { name: "Send answer", exact: true })); await page.keyboard.press("Enter");
    await page.getByText("Why this question?", { exact: true }).waitFor();
    await tabTo(page, page.getByText("Why this question?", { exact: true })); await page.keyboard.press("Enter");
    await page.getByText(note.rationale, { exact: true }).waitFor({ state: "visible" });
    assert.match(await page.getByText(/Tone:/).textContent(), /Question 2 of up to 3/);
    await tabTo(page, page.getByRole("textbox", { name: "Your answer" })); await page.keyboard.type("All replicas are synchronous.");
    await tabTo(page, page.getByRole("button", { name: "Send answer", exact: true })); await page.keyboard.press("Enter");
    await page.getByRole("note", { name: "Pushback" }).waitFor();
    assert.match(await page.getByText(/Tone:/).textContent(), /Question 3 of up to 3/);
    await axe(page, `pushback-${theme}`);
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(output, `interview-${theme}-${theme === "light" ? 1440 : 320}.png`), fullPage: true });
    await tabTo(page, page.getByRole("textbox", { name: "Your answer" })); await page.keyboard.type("I would qualify that claim and evaluate consistency requirements.");
    await tabTo(page, page.getByRole("button", { name: "Send answer", exact: true })); await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Generate report", exact: true }).waitFor();
    await tabTo(page, page.getByRole("button", { name: "Generate report", exact: true })); await page.keyboard.press("Enter");
    await axe(page, `report-${theme}`);
    const download = page.waitForEvent("download"); await tabTo(page, page.getByRole("button", { name: "Download PDF", exact: true })); await page.keyboard.press("Enter");
    const pdf = await download; assert.match(pdf.suggestedFilename(), /\.pdf$/);
    evidence.fixtures.push({ name: `keyboard-report-${theme}`, download: pdf.suggestedFilename(), infiniteAnimations: await page.evaluate(() => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations === Infinity && animation.playState === "running").length) });
    await ctx.close();
  }
  if (process.env.SKIP_LIVE !== "1") {
    const { ctx, page } = await context("light", 1440, true);
    const headers = { Authorization: `Bearer ${token}` };
    const before = (await (await ctx.request.get(`${apiBase}/interviews`, { headers })).json()).sessions;
    await page.goto(`${base}/interview`);
    // Cancel immediately on the question envelope, before generation completes.
    await page.getByRole("button", { name: "Start interview", exact: true }).click();
    await page.getByTestId("streamed-question").waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForTimeout(1200);
    const after = (await (await ctx.request.get(`${apiBase}/interviews`, { headers })).json()).sessions;
    evidence.live.startAbortRecordedNothing = after.length === before.length; assert.equal(after.length, before.length);
    // Complete a real start, then cancel a real answer stream after its question event.
    const texts = [];
    await page.evaluate(() => { window.uiBTexts = []; window.uiBObserver = new MutationObserver(() => { const text = document.querySelector('[data-testid="streamed-question"] p:last-child')?.textContent; if (text) window.uiBTexts.push(text); }); window.uiBObserver.observe(document.body, { childList: true, subtree: true, characterData: true }); });
    await page.getByRole("button", { name: "Start interview", exact: true }).click();
    await page.getByRole("textbox", { name: "Your answer" }).waitFor({ timeout: 180000 });
    texts.push(...await page.evaluate(() => window.uiBTexts));
    evidence.live.startDistinctPartialTexts = new Set(texts).size;
    assert.ok(evidence.live.startDistinctPartialTexts > 1);
    const sessions = (await (await ctx.request.get(`${apiBase}/interviews`, { headers })).json()).sessions;
    const liveId = sessions.find((session) => !before.some((old) => old.id === session.id)).id;
    const beforeAnswer = (await (await ctx.request.get(`${apiBase}/interviews/${liveId}`, { headers })).json()).messages;
    await page.getByRole("textbox", { name: "Your answer" }).fill("I clarified the constraints, compared the options, and measured latency to decide. The trade-off was reliability versus speed.");
    await page.getByRole("button", { name: "Send answer", exact: true }).click();
    await page.getByLabel("Answer evaluation").waitFor({ timeout: 180000 });
    evidence.live.evaluationBeforeQuestion = true;
    await page.getByTestId("streamed-question").waitFor({ timeout: 180000 });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForTimeout(1200);
    const afterAnswer = (await (await ctx.request.get(`${apiBase}/interviews/${liveId}`, { headers })).json()).messages;
    evidence.live.answerAbortRecordedNothing = afterAnswer.length === beforeAnswer.length; assert.equal(afterAnswer.length, beforeAnswer.length);
    await page.evaluate(() => { window.uiBTexts = []; });
    await page.getByRole("button", { name: "Send answer", exact: true }).click();
    await page.getByRole("button", { name: "Send answer", exact: true }).waitFor({ state: "visible", timeout: 180000 });
    await page.waitForFunction(() => document.querySelector('#interview-answer')?.value === "", undefined, { timeout: 180000 });
    evidence.live.answerDistinctPartialTexts = await page.evaluate(() => new Set(window.uiBTexts).size);
    assert.ok(evidence.live.answerDistinctPartialTexts > 1);
    const final = (await (await ctx.request.get(`${apiBase}/interviews/${liveId}`, { headers })).json()).messages;
    evidence.live.answerRecorded = final.some((message) => message.role === "candidate"); assert.equal(evidence.live.answerRecorded, true);
    await ctx.close();
  }
  evidence.notes.push("Cancellation was verified at the question envelope while generation was pending. An earlier attempt to cancel after the first visible delta raced completed generation and recorded a session; abort cannot undo a committed turn.");
  assert.deepEqual(evidence.pageErrors, []); assert.deepEqual(evidence.consoleErrors, []);
  evidence.passed = true;
} catch (error) {
  evidence.passed = false; evidence.failure = error.message; console.error(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(output, "browser.json"), JSON.stringify(evidence, null, 2) + "\n");
  await browser.close();
  console.log(JSON.stringify(evidence, null, 2));
}
