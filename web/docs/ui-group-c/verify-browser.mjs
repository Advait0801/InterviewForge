// PLAYWRIGHT_MODULE=/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs node web/docs/ui-group-c/verify-browser.mjs
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { groupCDaily, groupCIntegrity, groupCLink, groupCPath, groupCProblem, groupCQueue, groupCReplay, groupCSession } from "../../src/test/group-c-fixtures.ts";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = "http://localhost:3002";
const apiBase = "http://localhost:4000/api";
const out = path.dirname(new URL(import.meta.url).pathname);
const evidence = { browser: browser.version(), audits: [], screenshots: [], live: {}, errors: [] };
async function audit(page, name) {
  // Let entrance animations finish before measuring contrast.
  await page.waitForTimeout(700);
  await page.addScriptTag({ path: path.resolve("web/node_modules/axe-core/axe.min.js") });
  const result = await page.evaluate(async () => {
    const axe = await window.axe.run();
    return { serious: axe.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary, html: n.html })) })), all: axe.violations.map((v) => ({ id: v.id, impact: v.impact })), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  evidence.audits.push({ name, ...result }); assert.deepEqual(result.serious, [], `axe ${name}`); assert.equal(result.overflow, false, `overflow ${name}`);
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true, animations: "disabled" }); evidence.screenshots.push(`${name}.png`);
}
async function tabTo(page, locator) {
  for (let i = 0; i < 100; i++) { if (await locator.evaluate((e) => e === document.activeElement)) return; await page.keyboard.press("Tab"); }
  throw new Error("Keyboard could not reach control");
}
try {
  for (const theme of (process.env.SKIP_FIXTURES === "1" ? [] : ["light", "dark"])) {
    const width = theme === "light" ? 1440 : 320;
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: "if-token", value: "fixture-token" }, { name: "if-theme", value: theme }] }] } });
    let customRejected = false; let links = [groupCLink]; let queue = structuredClone(groupCQueue); const bodies = []; const publicHeaders = [];
    await context.route(/\/api\//, async (route) => {
      const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const method = req.method();
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (p.endsWith("/users/me")) return json({ user: { id: "viewer", name: "Viewer Private Account", username: "viewer", email: "viewer@example.invalid", email_verified: false, avatar_url: null } });
      if (p.endsWith("/review")) return json(queue);
      if (p.endsWith("/review/p")) { if (method === "DELETE") { queue.due = []; queue.counts.due = 0; queue.counts.total--; } return json({ added: true, ok: true }, method === "POST" ? 201 : 200); }
      if (p.endsWith("/problems/daily")) return json(groupCDaily);
      if (p.endsWith("/problems/daily/history")) return json({ days: Array.from({ length: 30 }, (_, i) => ({ ...groupCDaily, date: new Date(Date.UTC(2026, 9, 11 - i)).toISOString().slice(0, 10), solvedOnDay: i % 3 === 0, solved: i % 2 === 0 })), streak: groupCDaily.streak });
      if (p.endsWith("/learning-paths")) return json({ paths: [{ ...groupCPath.path, id: "my-focus" }] });
      if (p.endsWith("/learning-paths/generate")) return json(groupCPath, 201);
      if (p.endsWith("/learning-paths/my-focus")) return json(groupCPath);
      if (p.endsWith("/interviews")) return json({ sessions: [groupCSession] });
      if (p.endsWith("/interviews/s/replay")) return json(groupCReplay);
      if (p.endsWith("/interviews/s/share/link")) { links = []; return json({ ok: true }); }
      if (p.endsWith("/interviews/s/share")) {
        if (method === "POST") { links = [groupCLink]; return json({ link: groupCLink, token: "fixture-once-ab3d", resumeGrounded: true }, 201); }
        return json({ links });
      }
      if (p.includes("/public/interviews/")) { publicHeaders.push(req.headers()); return links.length ? json({ ...groupCReplay, candidate: "QA Candidate" }) : json({ error: "Not found" }, 404); }
      if (p.endsWith("/assessments/a")) return json({ assessment: { id: "a", status: "active", score: null, difficulty_mix: "mixed", time_limit_minutes: 60 }, problems: [{ id: "ap", problem_id: "p", title: "Two Sum", slug: "two-sum", difficulty: "easy", submission_id: null }], remainingMs: 600000, integrity: groupCIntegrity });
      if (p.endsWith("/assessments/a/events")) { bodies.push(req.postDataJSON()); return json({ recorded: req.postDataJSON().events.length, integrity: groupCIntegrity }, 201); }
      if (p.endsWith("/assessments/a/submit")) return json({ score: 100, status: "completed", integrity: groupCIntegrity });
      if (p.endsWith("/submissions") && method === "GET") return json({ submissions: [], total: 0, limit: 50, offset: 0 });
      if (p.endsWith("/submissions") && method === "POST") {
        const body = req.postDataJSON(); bodies.push(body);
        if (body.mode === "submit") return json({ mode: "submit", submissionId: "sub", status: "failed", passed: false, results: [{ passed: false, hidden: false, input: "nums = [3,3], target = 6", expectedOutput: "[0,1]", actualOutput: "[0,2]", diff: { kind: "value", path: [1], expected: 1, actual: 2 } }], review: { action: "enrolled", quality: 1, dueOn: "2026-10-12", intervalDays: 1 } }, 201);
        if (body.customInputs?.includes("broken")) { customRejected = true; return json({ error: "Invalid custom test case", customInputErrors: [{ index: body.customInputs.indexOf("broken"), error: "Missing target" }] }, 400); }
        return json({ mode: "run", passed: false, results: [{ passed: false, actualOutput: "[0,2]", diff: { kind: "value", path: [1], expected: 1, actual: 2 } }], testCases: groupCProblem.test_cases, customResults: [{ input: "nums = [3,3], target = 6", judged: true, passed: false, expectedOutput: "[0,1]", actualOutput: "[0,2]", diff: { kind: "value", path: [1], expected: 1, actual: 2 } }, { input: "Signature diagnostic", judged: false, passed: false, inputError: "Reference unavailable", actualOutput: "[]" }] });
      }
      if (p.endsWith("/hints/viewed")) return json({ hintsViewed: req.postDataJSON().count });
      if (p.endsWith("/problems/p")) return json({ problem: groupCProblem });
      if (p.endsWith("/auth/resend-verification")) return json({ ok: true });
      if (p.endsWith("/users/stats")) return json({ problemsAttempted: 2, interviewsStarted: 1, bestStreak: 7 });
      if (p.endsWith("/users/activity")) return json({ currentStreak: 3, bestStreak: 7, activityMap: {} });
      if (p.endsWith("/recommendations")) return json({ recommended: [], revisit: [], focusAreas: [] });
      return json({ error: `Unhandled fixture ${p}` }, 501);
    });
    const page = await context.newPage(); page.on("pageerror", (error) => evidence.errors.push(error.message));
    await page.goto(`${base}/problems/p`); await page.getByRole("heading", { name: "Two Sum" }).waitFor();
    assert.equal(await page.getByLabel("Language").locator("option").count(), 7);
    if (width === 320) await page.getByRole("button", { name: "Editor", exact: true }).click();
    await page.getByRole("button", { name: "Open console" }).click();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Add custom case" }).click();
    await page.getByLabel("Custom case 1", { exact: true }).fill(""); await page.getByLabel("Custom case 3", { exact: true }).fill("broken");
    await page.getByRole("button", { name: "Run code" }).click(); await page.getByText("Missing target", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("Custom case 3", { exact: true }).evaluate((e) => e === document.activeElement), true); assert.equal(customRejected, true);
    await audit(page, `problem-custom-errors-${theme}`);
    await page.getByLabel("Custom case 3", { exact: true }).fill("nums = [3,3], target = 6");
    await page.getByRole("button", { name: "Run code" }).click(); await page.getByText(/First difference at \[1\]/).first().waitFor();
    await page.getByRole("separator").focus(); await page.keyboard.press("End");
    await audit(page, `problem-results-${theme}`); await screenshot(page, `problem-${theme}-${width}`);
    await page.getByRole("button", { name: "Submit", exact: true }).click(); await page.getByText(/Added to your review queue/).waitFor(); assert.equal("customInputs" in bodies.filter((b) => b.mode).at(-1), false);
    await page.goto(`${base}/review`); await page.getByRole("heading", { name: "Due now (1)" }).waitFor(); await audit(page, `review-${theme}`); await screenshot(page, `review-${theme}-${width}`);
    page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Remove Two Sum from your review queue" }).click(); await page.getByRole("heading", { name: "Due now (0)" }).waitFor();
    await page.goto(`${base}/daily`); await page.getByText("3-day streak · best 7").waitFor(); assert.equal(await page.getByRole("listitem").count(), 30); await audit(page, `daily-${theme}`);
    await page.goto(`${base}/paths`); await page.getByRole("button", { name: "Rebuild my focus path" }).waitFor(); await audit(page, `paths-${theme}`);
    await page.getByRole("button", { name: "Rebuild my focus path" }).click(); await page.getByRole("heading", { name: "Built from" }).waitFor(); await audit(page, `focus-path-${theme}`);
    await page.goto(`${base}/interview/s`); await page.getByRole("heading", { name: "google interview replay" }).waitFor(); await page.getByRole("button", { name: "Share", exact: true }).waitFor(); await audit(page, `replay-${theme}`); await screenshot(page, `replay-${theme}-${width}`);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByLabel("Speed").selectOption("4");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    await page.getByText("Solve Two Sum.", { exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Share", exact: true }).click(); await page.getByText("The questions in this interview may mention your résumé.", { exact: true }).waitFor(); await audit(page, `share-dialog-${theme}`);
    await tabTo(page, page.getByLabel("Display name (optional)")); await page.keyboard.type("QA Candidate");
    await tabTo(page, page.getByRole("button", { name: "Create share link" })); await page.keyboard.press("Enter");
    await page.getByLabel("Share URL").waitFor(); assert.equal(await page.getByLabel("Share URL").inputValue(), `${base}/share/fixture-once-ab3d`);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Share", exact: true }).click(); assert.equal(await page.getByLabel("Share URL").count(), 0); await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.goto(`${base}/share/fixture-once-ab3d`); await page.getByText("QA Candidate", { exact: true }).waitFor();
    assert.equal(await page.getByText("Viewer Private Account", { exact: false }).count(), 0); assert.equal(publicHeaders.at(-1).authorization, undefined);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow"); assert.equal(await page.locator('meta[name="referrer"]').getAttribute("content"), "no-referrer");
    await audit(page, `public-share-${theme}`); await screenshot(page, `share-${theme}-${width}`);
    await page.goto(`${base}/interview/s`); page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Revoke …ab3d" }).click(); await page.getByText("No active share links.").waitFor();
    await page.goto(`${base}/share/fixture-once-ab3d`); await page.getByText("This link doesn't exist or is no longer shared.", { exact: true }).waitFor(); await audit(page, `public-revoked-${theme}`);
    await page.goto(`${base}/assessments/a`); await page.getByRole("heading", { name: "Two Sum" }).waitFor(); await page.getByText(/This assessment records/).waitFor(); assert.equal(await page.getByLabel("Language").locator("option").count(), 7); await audit(page, `assessment-active-${theme}`);
    await page.evaluate(() => { const event = new Event("paste", { bubbles: true }); Object.defineProperty(event, "clipboardData", { value: { getData: () => "fixture private clipboard" } }); document.dispatchEvent(event); document.dispatchEvent(new CustomEvent("if-editor-copy", { detail: { chars: 9 } })); });
    await page.getByRole("button", { name: "Finish assessment" }).click(); await page.getByRole("heading", { name: "Integrity summary" }).waitFor();
    assert.ok(bodies.some((body) => body.events?.some((event) => event.type === "paste" && event.chars === 25))); assert.ok(!JSON.stringify(bodies.filter((body) => body.events)).includes("fixture private clipboard")); await audit(page, `assessment-results-${theme}`);
    await page.goto(`${base}/dashboard`); await page.getByRole("heading", { name: "Problem of the Day" }).waitFor(); await page.getByText("Solved today").waitFor(); await page.getByRole("button", { name: "Resend email" }).click(); await page.getByText("Sent — check your inbox and Spam").waitFor(); await audit(page, `dashboard-${theme}`);
    await context.close();
  }
  // Anonymous access in a fresh private browser context.
  const anon = await browser.newContext(); await anon.route(/\/api\/public\//, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...groupCReplay, candidate: "Private Window Candidate" }) }));
  const anonPage = await anon.newPage(); await anonPage.goto(`${base}/share/private-window`); await anonPage.getByText("Private Window Candidate").waitFor(); evidence.live.privateWindowFixture = true; await anon.close();
  // Live checks use a disposable account. Credentials and bearer token stay in memory.
  const live = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const identity = crypto.randomBytes(6).toString("hex");
  const registration = await live.request.post(`${apiBase}/auth/register`, { data: { username: `ui_c_${identity}`, email: `ui_c_${identity}@example.invalid`, password: crypto.randomBytes(24).toString("base64url"), fullName: "UI C QA" } });
  assert.equal(registration.status(), 201); const { token } = await registration.json();
  await live.addInitScript((token) => { localStorage.setItem("if-token", token); localStorage.setItem("if-theme", "light"); }, token);
  const list = await (await live.request.get(`${apiBase}/problems`)).json(); const problem = list.problems.find((p) => p.slug === "two-sum"); assert.ok(problem);
  const page = await live.newPage(); await page.goto(`${base}/problems/${problem.id}`); await page.getByRole("heading", { name: "Two Sum" }).waitFor();
  await page.getByRole("button", { name: "Open console" }).click(); await page.getByRole("button", { name: "Add custom case" }).click(); await page.getByLabel("Custom case 1", { exact: true }).fill("nums = [3,3], target = 6");
  const solutions = {
    javascript: 'var twoSum = function(nums, target) { const seen = new Map(); for (let i=0; i<nums.length; i++) { if (seen.has(target-nums[i])) return [seen.get(target-nums[i]), i]; seen.set(nums[i], i); } return []; };',
    go: 'func twoSum(nums []int, target int) []int { seen := make(map[int]int); for i, n := range nums { if j, ok := seen[target-n]; ok { return []int{j, i} }; seen[n] = i }; return []int{} }',
    rust: 'impl Solution { pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> { let mut seen = std::collections::HashMap::new(); for (i, n) in nums.iter().enumerate() { if let Some(j) = seen.get(&(target - n)) { return vec![*j, i as i32]; } seen.insert(*n, i as i32); } vec![] } }',
  };
  evidence.live.languages = [];
  for (const [language, code] of Object.entries(solutions)) {
    const historyLoaded = page.waitForResponse((r) => r.url().includes("/api/submissions?") && r.request().method() === "GET");
    await page.getByLabel("Language").selectOption(language); await historyLoaded;
    await page.waitForFunction(() => window.monaco?.editor.getEditors().length);
    await page.waitForTimeout(200);
    await page.evaluate((code) => { window.monaco.editor.getEditors()[0].getModel().setValue(code); }, code);
    await page.waitForTimeout(200);
    const runResponse = page.waitForResponse((r) => r.url().endsWith("/api/submissions") && r.request().method() === "POST", { timeout: 120000 }); await page.getByRole("button", { name: "Run code" }).click(); const run = await runResponse; const body = await run.json(); assert.equal(run.status(), 200); evidence.live.lastRun = { language, sentCodeMatches: run.request().postDataJSON().code === code, sentCode: run.request().postDataJSON().code, result: body }; assert.equal(body.passed, true, `${language} Run`); assert.equal(body.customResults[0].passed, true); assert.equal(body.customResults[0].expectedOutput, "[0,1]");
    const submitResponse = page.waitForResponse((r) => r.url().endsWith("/api/submissions") && r.request().method() === "POST", { timeout: 120000 }); await page.getByRole("button", { name: "Submit", exact: true }).click(); const submit = await submitResponse; const submission = await submit.json(); assert.equal(submit.status(), 201); assert.equal(submission.passed, true, `${language} Submit`); assert.equal(submit.request().postDataJSON().customInputs, undefined);
    evidence.live.languages.push({ language, runPassed: body.passed, customPassed: body.customResults[0].passed, submitPassed: submission.passed, cases: submission.results.length });
  }
  await page.getByRole("tab", { name: "Test Cases", exact: true }).click(); await page.getByLabel("Custom case 1", { exact: true }).fill("broken"); await page.getByRole("button", { name: "Run code" }).click(); await page.locator('[aria-invalid="true"]').waitFor(); assert.equal(await page.getByText("Execution failed", { exact: true }).count(), 0); evidence.live.invalidCustomInline = true;
  await page.getByRole("tab", { name: "Hints", exact: true }).click(); const hintResponse = page.waitForResponse((r) => r.url().endsWith("/hints/viewed")); await page.getByRole("button", { name: "Show hint 1" }).click(); assert.equal((await hintResponse).status(), 200); evidence.live.hintReported = true;
  await page.getByRole("button", { name: "Add to review" }).click(); await page.getByRole("button", { name: "Added", exact: true }).waitFor(); await page.goto(`${base}/review`); await page.getByRole("heading", { name: "Two Sum" }).waitFor(); evidence.live.reviewAdded = true;
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Remove Two Sum from your review queue" }).click(); await page.getByText(/Nothing to review yet/).waitFor(); evidence.live.reviewRemoved = true;
  await page.goto(`${base}/share/unknown-public-token`); await page.getByText("This link doesn't exist or is no longer shared.", { exact: true }).waitFor(); evidence.live.public404 = true;
  await live.close();
  delete evidence.live.lastRun;
  assert.deepEqual(evidence.errors, []); evidence.passed = true;
} catch (error) {
  evidence.passed = false; evidence.failure = error.stack; process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(out, "browser.json"), JSON.stringify(evidence, null, 2) + "\n"); await browser.close();
  console.log(JSON.stringify(evidence, null, 2));
}
