/**
 * Phase 12: does the Elo picker hit its target success rate? (D-076)
 *
 *   npx ts-node scripts/simulate_elo.ts                 # the default world
 *   npx ts-node scripts/simulate_elo.ts --scale 300     # a world whose true curve isn't Elo's
 *
 * Pure simulation (src/eval/elo-simulation.ts) on the real problem set; no database, no model.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { simulateElo } from "../src/eval/elo-simulation";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : undefined;
};

const problems = (JSON.parse(readFileSync(join(__dirname, "..", "leetcode_problems.json"), "utf8")) as Array<{
  slug: string;
  difficulty: string;
  topics: string[];
}>).map(({ slug, difficulty, topics }) => ({ slug, difficulty: difficulty.toLowerCase(), topics }));

const report = simulateElo({
  problems,
  users: arg("users"),
  picks: arg("picks"),
  seed: arg("seed"),
  trueScale: arg("scale"),
  problemNoise: arg("noise"),
  userCenter: arg("center"),
});
console.log(JSON.stringify(report, null, 2));
