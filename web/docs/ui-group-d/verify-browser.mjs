// Run from the repo root. Defaults use the existing local browser tooling.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {
  groupCProblem,
  groupCDaily,
  groupCQueue,
} from "../../src/test/group-c-fixtures.ts";
import {
  complexity,
  populatedAnalytics,
  peerSession,
  rating,
} from "../../src/test/group-d-fixtures.ts";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.WEB_URL || "http://localhost:3002";
const out = path.dirname(new URL(import.meta.url).pathname);
const evidence = {
  browser: browser.version(),
  audits: [],
  screenshots: [],
  errors: [],
  interactions: [],
};
async function audit(page, name) {
  await page.waitForTimeout(700);
  await page.addScriptTag({
    path: path.resolve("web/node_modules/axe-core/axe.min.js"),
  });
  const result = await page.evaluate(async () => {
    const result = await window.axe.run();
    return {
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      overflow: document.documentElement.scrollWidth > innerWidth,
      mediaCalls: window.__mediaCalls,
    };
  });
  evidence.audits.push({ name, ...result });
  const failures = result.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact),
  );
  assert.deepEqual(failures, [], `axe ${name}`);
  assert.equal(result.overflow, false, `overflow ${name}`);
  assert.equal(result.mediaCalls, 0, `media opt in ${name}`);
}
async function capture(page, name) {
  await page.screenshot({
    path: path.join(out, name + ".png"),
    fullPage: true,
    animations: "disabled",
  });
  evidence.screenshots.push(name + ".png");
}
try {
  for (const theme of ["light", "dark"]) {
    for (const width of [320, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 950 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ origin, theme }) => {
          if (location.origin === origin) {
            localStorage.setItem("if-token", "fixture-token");
            localStorage.setItem("if-theme", theme);
          }
          window.__mediaCalls = 0;
          if (navigator.mediaDevices)
            navigator.mediaDevices.getUserMedia = async () => {
              window.__mediaCalls++;
              throw new DOMException("QA media mock", "NotAllowedError");
            };
        },
        { origin: base, theme },
      );
      let liveSession = structuredClone(peerSession);
      let created = false;
      let picksEmpty = false;
      let ratingsEmpty = false;
      let requestsFailed = false;
      let submission = false;
      let measurement = structuredClone(complexity);
      await context.route(/\/api\//, (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const p = url.pathname;
        const method = request.method();
        const json = (body, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(body),
          });
        if (p.endsWith("/users/me"))
          return json({
            user: {
              id: "qa",
              name: "Ada",
              username: "ada",
              avatar_url: null,
              email: "qa@example.org",
              email_verified: true,
            },
          });
        if (p.endsWith("/users/stats"))
          return json({
            problemsAttempted: 10,
            interviewsStarted: 2,
            assessmentsCompleted: 0,
            learningPathsCompleted: 0,
          });
        if (p.endsWith("/users/activity"))
          return json({ daily: [], streak: { current: 0, best: 0 } });
        if (p.endsWith("/users/analytics"))
          return json(
            ratingsEmpty
              ? {
                  solvedOverTime: [],
                  topicStrengths: [],
                  difficultyDistribution: {},
                  acceptanceTrend: [],
                }
              : populatedAnalytics,
          );
        if (p.endsWith("/recommendations"))
          return json({ error: "Recommendations unavailable in QA" }, 503);
        if (p.endsWith("/problems/daily")) return json(groupCDaily);
        if (p.endsWith("/review")) return json(groupCQueue);
        if (p.endsWith("/ratings/next"))
          return requestsFailed
            ? json({ error: "Picks temporarily unavailable" }, 503)
            : json({
                target: 0.65,
                picks: picksEmpty
                  ? []
                  : [
                      {
                        problem: {
                          id: "p",
                          slug: "two-sum",
                          title: "Two Sum",
                          difficulty: "easy",
                          topics: ["Arrays"],
                        },
                        predictedSuccess: 0.68,
                        problemRating: 1400,
                        userRating: 1510,
                      },
                    ],
              });
        if (p.endsWith("/ratings/me"))
          return requestsFailed
            ? json({ error: "Ratings temporarily unavailable" }, 503)
            : json(
                ratingsEmpty
                  ? { overall: { rating: 1500, games: 0 }, topics: [] }
                  : {
                      overall: { rating: 1510, games: 8 },
                      topics: [
                        { topic: "Arrays", rating: 1540, games: 6 },
                        { topic: "Graphs", rating: 1430, games: 2 },
                      ],
                    },
              );
        if (p.endsWith("/problems")) return json({ problems: [groupCProblem] });
        if (p.endsWith("/problems/p")) return json({ problem: groupCProblem });
        if (p.endsWith("/submissions") && method === "GET")
          return json({
            submissions: submission
              ? [
                  {
                    id: "s",
                    status: "passed",
                    language: "python3",
                    created_at: "2026-10-11T20:00:00Z",
                    runtime_ms: 10,
                    memory_kb: 100,
                  },
                ]
              : [],
            total: submission ? 1 : 0,
            limit: 50,
            offset: 0,
          });
        if (p.endsWith("/submissions") && method === "POST") {
          submission = true;
          return json(
            {
              mode: "submit",
              passed: true,
              status: "passed",
              submissionId: "s",
              review: null,
              rating,
              results: [
                {
                  passed: true,
                  hidden: false,
                  input: "1",
                  expectedOutput: "1",
                  actualOutput: "1",
                },
              ],
            },
            201,
          );
        }
        if (p.endsWith("/submissions/s"))
          return json({
            submission: {
              id: "s",
              problem_id: "p",
              status: "passed",
              language: "python3",
              code: "print(1)",
              created_at: "2026-10-11T20:00:00Z",
              runtime_ms: 10,
              memory_kb: 100,
            },
          });
        if (p.endsWith("/complexity"))
          return method === "GET"
            ? json({ available: true, analysis: measurement })
            : json({ analysis: measurement });
        if (p.endsWith("/ice-servers"))
          return json({ iceServers: [], expiresAt: null });
        if (p.endsWith("/peer-sessions") && method === "GET")
          return requestsFailed
            ? json({ error: "Peer sessions temporarily unavailable" }, 503)
            : json({ sessions: created ? [liveSession] : [] });
        if (p.endsWith("/peer-sessions") && method === "POST") {
          created = true;
          return json(
            { session: liveSession, inviteToken: "fixture-fragment-token" },
            201,
          );
        }
        if (p.endsWith("/peer-sessions/join"))
          return json({ error: "Not found" }, 404);
        if (p.endsWith("/peer-sessions/peer-id"))
          return json({ session: liveSession });
        if (p.endsWith("/feedback")) {
          liveSession.feedback.given = {
            ratings: request.postDataJSON().ratings,
            notes: request.postDataJSON().notes,
            createdAt: "2026-10-11",
          };
          return json({ session: liveSession });
        }
        return json({ error: `Fixture has no ${p}` }, 404);
      });
      // Documented Socket.IO packets over Engine.IO polling. No real media or users.
      const packets = [];
      let pendingPoll = null;
      function send(packet) {
        if (pendingPoll) {
          const route = pendingPoll;
          pendingPoll = null;
          void route.fulfill({ contentType: "text/plain", body: packet });
        } else packets.push(packet);
      }
      await context.route(/\/socket\.io\//, async (route) => {
        const url = new URL(route.request().url());
        const request = route.request();
        if (request.method() === "GET") {
          if (!url.searchParams.has("sid"))
            return route.fulfill({
              contentType: "text/plain",
              body: '0{"sid":"qa-engine","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}',
            });
          if (packets.length)
            return route.fulfill({
              contentType: "text/plain",
              body: packets.splice(0).join("\u001e"),
            });
          pendingPoll = route;
          return;
        }
        const text = request.postData() ?? "";
        for (const packet of text.split("\u001e")) {
          if (packet.startsWith("40/peer,")) send('40/peer,{"sid":"qa-peer"}');
          const match = /^42\/peer,(\d*)(\[.*\])$/.exec(packet);
          if (!match) continue;
          const [event, payload] = JSON.parse(match[2]);
          const id = match[1];
          if (event === "join")
            send(
              `43/peer,${id}${JSON.stringify([{ ok: true, session: liveSession, presence: { interviewer: true, candidate: false } }])}`,
            );
          if (event === "code") {
            liveSession.code = payload.code;
            liveSession.language = payload.language;
          }
          if (event === "end") {
            liveSession = {
              ...liveSession,
              status: "completed",
              endedReason: "ended_by_participant",
              endedAt: "2026-10-11T20:45:00Z",
            };
            send(
              `43/peer,${id}${JSON.stringify([{ ok: true, session: liveSession }])}`,
            );
            send(
              `42/peer,${JSON.stringify(["ended", { reason: "ended_by_participant" }])}`,
            );
          }
        }
        return route.fulfill({ contentType: "text/plain", body: "ok" });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.on("pageerror", (error) =>
        evidence.errors.push({ theme, width, message: error.message }),
      );
      await page.goto(base + "/peer");
      await page.getByText("No peer interviews yet").waitFor();
      await audit(page, `peer-empty-${theme}-${width}`);
      await page.getByRole("button", { name: "Create invite" }).click();
      await page.getByLabel("Invite link", { exact: true }).waitFor();
      assert.match(
        await page.getByLabel("Invite link", { exact: true }).inputValue(),
        /\/peer\/join#fixture-fragment-token$/,
      );
      await audit(page, `peer-invite-${theme}-${width}`);
      await capture(page, `peer-invite-${theme}-${width}`);
      await page.getByRole("button", { name: "Dismiss invite" }).click();
      assert.equal(
        await page.getByLabel("Invite link", { exact: true }).count(),
        0,
      );
      await page.getByRole("link", { name: "Open room", exact: true }).click();
      await page
        .getByText("waiting for your partner", { exact: false })
        .first()
        .waitFor();
      await audit(page, `peer-room-${theme}-${width}`);
      await capture(page, `peer-room-${theme}-${width}`);
      assert.equal(await page.evaluate(() => window.__mediaCalls), 0);
      if (width === 1440)
        assert.equal(
          await page
            .getByRole("navigation", { name: "Primary navigation" })
            .getByRole("link", { name: "Peer", exact: true })
            .isVisible(),
          true,
        );
      else {
        await page.getByRole("button", { name: "Toggle menu" }).click();
        await page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("link", { name: "Peer", exact: true })
          .waitFor();
        await audit(page, `peer-mobile-menu-${theme}-${width}`);
        await page.keyboard.press("Escape");
      }
      send(
        `42/peer,${JSON.stringify(["code", { from: "partner", code: "// partner wrote this", language: "rust" }])}`,
      );
      await page.getByLabel("Language", { exact: true }).selectOption("go");
      await page.waitForTimeout(400);
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "End session", exact: true })
        .click();
      await page.getByText("A participant ended the interview.").waitFor();
      await audit(page, `peer-feedback-${theme}-${width}`);
      await capture(page, `peer-feedback-${theme}-${width}`);
      for (const label of ["Problem solving", "Communication", "Code quality"])
        await page.getByLabel(label, { exact: true }).selectOption("4");
      await page
        .getByRole("button", { name: "Submit feedback", exact: true })
        .click();
      await page.getByText("Feedback submitted", { exact: true }).waitFor();
      await page.goto(base + "/peer/join#bad-invite");
      await page
        .getByText("This invite doesn't exist or is no longer open.")
        .waitFor();
      assert.equal(new URL(page.url()).hash, "");
      await audit(page, `peer-join-missing-${theme}-${width}`);
      await page.goto(base + "/dashboard");
      await page.getByRole("heading", { name: "Next up for you" }).waitFor();
      await page.getByText("68% predicted to pass first time").waitFor();
      await audit(page, `next-up-${theme}-${width}`);
      await page.getByLabel("Topic filter (optional)").fill("Arrays");
      await page.getByRole("button", { name: "Apply topic" }).click();
      await page.getByRole("button", { name: "Clear topic" }).waitFor();
      picksEmpty = true;
      await page.getByRole("button", { name: "Clear topic" }).click();
      await page.getByText("Nothing left in this selection").waitFor();
      await audit(page, `next-up-empty-${theme}-${width}`);
      await page.goto(base + "/analytics");
      await page.getByText("Overall: 1510", { exact: false }).waitFor();
      await audit(page, `ratings-${theme}-${width}`);
      await capture(page, `ratings-${theme}-${width}`);
      ratingsEmpty = true;
      await page.reload();
      await page
        .getByText("Your first Submit of any problem starts your rating")
        .waitFor();
      await audit(page, `ratings-empty-${theme}-${width}`);
      await page.goto(base + "/problems/p");
      await page.getByRole("heading", { name: "Two Sum" }).waitFor();
      if (width === 320)
        await page.getByRole("button", { name: "Editor", exact: true }).click();
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await page.getByRole("button", { name: "Measure again" }).waitFor();
      await page.getByRole("separator").focus();
      await page.keyboard.press("End");
      await audit(page, `complexity-${theme}-${width}`);
      await capture(page, `complexity-${theme}-${width}`);
      await page.getByRole("button", { name: "Measure again" }).click();
      await page.getByRole("table", { name: "Measured times" }).waitFor();
      if (width === 320)
        await page
          .getByRole("button", { name: "Problem", exact: true })
          .click();
      await page.getByRole("tab", { name: "Submissions", exact: true }).click();
      await page.getByRole("button", { name: /Accepted/ }).click();
      await page.getByRole("dialog", { name: "Submission detail" }).waitFor();
      await page
        .getByRole("dialog")
        .getByRole("table", { name: "Measured times" })
        .waitFor();
      await audit(page, `complexity-detail-${theme}-${width}`);
      await page
        .getByRole("button", { name: "Close submission detail" })
        .click();
      requestsFailed = true;
      await page.goto(base + "/peer");
      await page.getByText("Peer sessions temporarily unavailable").waitFor();
      await audit(page, `peer-error-${theme}-${width}`);
      evidence.interactions.push({
        theme,
        width,
        inviteFragment: true,
        inviteDismissed: true,
        socketRoom: true,
        feedbackSaved: true,
        hashCleared: true,
        sharedLanguage: true,
        topicFilter: true,
        measureAgain: true,
        submitRating: true,
        submissionDetail: true,
      });
      await context.close();
    }
  }
  assert.deepEqual(evidence.errors, []);
} finally {
  await fs.writeFile(
    path.join(out, "browser.json"),
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    audits: evidence.audits.length,
    screenshots: evidence.screenshots.length,
    pageErrors: evidence.errors.length,
    interactions: evidence.interactions.length,
  }),
);
