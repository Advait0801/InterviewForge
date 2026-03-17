import { query } from "../src/db";
import * as fs from "fs";
import * as path from "path";

type TestCase = { input: string; expectedOutput: string };

type LeetCodeProblem = {
  slug: string;
  title: string;
  leetcodeNumber: number;
  description: string;
  difficulty: string;
  topics: string[];
  companies: string[];
  testCases: TestCase[];
};

async function main() {
  const filePath = path.join(__dirname, "..", "leetcode_problems.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const problems = JSON.parse(raw) as LeetCodeProblem[];

  for (const p of problems) {
    await query(
      `INSERT INTO problems (slug, title, description, difficulty, test_cases)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         difficulty = EXCLUDED.difficulty,
         test_cases = EXCLUDED.test_cases`,
      [p.slug, p.title, p.description, p.difficulty, JSON.stringify(p.testCases)]
    );
    console.log("Upserted problem:", p.slug);
  }

  console.log("Seeding complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});