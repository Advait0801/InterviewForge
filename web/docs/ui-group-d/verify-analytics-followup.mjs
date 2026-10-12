// Run from the repository root. Uses fixture responses and real Recharts.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { populatedAnalytics } from "../../src/test/group-d-fixtures.ts";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.WEB_URL || "http://localhost:3002";
const evidence = { browser: browser.version(), audits: [], errors: [] };
try {
  for (const theme of ["light", "dark"]) {
    for (const width of [320, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 950 },
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ base, theme }) => {
          if (location.origin === base) {
            localStorage.setItem("if-token", "fixture-token");
            localStorage.setItem("if-theme", theme);
          }
        },
        { base, theme },
      );
      await context.route(/\/api\//, (route) => {
        const p = new URL(route.request().url()).pathname;
        let body;
        if (p.endsWith("/users/me"))
          body = {
            user: { id: "qa", name: "Ada", username: "ada", avatar_url: null },
          };
        else if (p.endsWith("/review")) body = { counts: { due: 0 } };
        else if (p.endsWith("/users/analytics")) body = populatedAnalytics;
        else if (p.endsWith("/ratings/me"))
          body = {
            overall: { rating: 1500, games: 1 },
            topics: [{ topic: "Arrays", rating: 1500, games: 1 }],
          };
        else throw new Error(`Unexpected API fixture: ${p}`);
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => evidence.errors.push(error.message));
      await page.goto(base + "/analytics");
      await page.getByText("1500 rating · 1 game", { exact: true }).waitFor();
      await page
        .locator("[aria-hidden=true] .recharts-wrapper")
        .nth(3)
        .waitFor();
      await page.waitForTimeout(700);
      await page.addScriptTag({
        path: path.resolve(
          path.dirname(new URL(import.meta.url).pathname),
          "../../node_modules/axe-core/axe.min.js",
        ),
      });
      for (const tablesOpen of [false, true]) {
        if (tablesOpen)
          for (const summary of await page.locator("details summary").all())
            await summary.click();
        const result = await page.evaluate(async () => {
          const axe = await window.axe.run();
          const hiddenFocus = [
            ...document.querySelectorAll('[aria-hidden="true"]'),
          ].flatMap((hidden) =>
            [
              ...hidden.querySelectorAll(
                'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], audio[controls], video[controls], iframe, summary',
              ),
            ]
              .filter((el) => el.tabIndex >= 0)
              .map((el) => el.outerHTML),
          );
          return {
            violations: axe.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              targets: v.nodes.map((n) => n.target),
            })),
            hiddenFocus,
            overflow: document.documentElement.scrollWidth > innerWidth,
            tables: document.querySelectorAll("details[open] table").length,
          };
        });
        evidence.audits.push({ theme, width, tablesOpen, ...result });
        assert.deepEqual(
          result.violations.filter((v) =>
            ["serious", "critical"].includes(v.impact),
          ),
          [],
        );
        assert.deepEqual(result.hiddenFocus, []);
        assert.equal(result.overflow, false);
        if (tablesOpen) assert.equal(result.tables, 4);
      }
      await context.close();
    }
  }
  assert.deepEqual(evidence.errors, []);
} finally {
  await fs.writeFile(
    new URL("followup-axe.json", import.meta.url),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await browser.close();
}
console.log(
  JSON.stringify({
    audits: evidence.audits.length,
    pageErrors: evidence.errors.length,
  }),
);
