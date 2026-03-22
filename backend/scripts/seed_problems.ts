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

type StarterEntry = {
  meta: Record<string, unknown>;
  python3: string;
  cpp: string;
  c: string;
  java: string;
};

async function main() {
  const filePath = path.join(__dirname, "..", "leetcode_problems.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const problems = JSON.parse(raw) as LeetCodeProblem[];

  const templatesPath = path.join(__dirname, "..", "starter_templates.json");
  const templates = JSON.parse(fs.readFileSync(templatesPath, "utf-8")) as Record<string, StarterEntry>;

  for (const p of problems) {
    const tmpl = templates[p.slug];
    const starterCode = tmpl
      ? { python3: tmpl.python3, cpp: tmpl.cpp, c: tmpl.c, java: tmpl.java }
      : {};

    await query(
      `INSERT INTO problems (slug, title, description, difficulty, test_cases, starter_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         difficulty = EXCLUDED.difficulty,
         test_cases = EXCLUDED.test_cases,
         starter_code = EXCLUDED.starter_code`,
      [p.slug, p.title, p.description, p.difficulty, JSON.stringify(p.testCases), JSON.stringify(starterCode)]
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