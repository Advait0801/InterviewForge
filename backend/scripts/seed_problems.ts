import { query } from "../src/db";
import * as fs from "fs";
import * as path from "path";

type TestCase = { input: string; expectedOutput: string };

const MIN_SUBMIT_CASES = 50;

/** Pad with cyclical repeats so Submit always has at least MIN_SUBMIT_CASES (same I/O, valid grading). */
function padTestCases(cases: TestCase[]): TestCase[] {
  if (cases.length === 0) return cases;
  if (cases.length >= MIN_SUBMIT_CASES) return cases;
  const out: TestCase[] = [...cases];
  let i = 0;
  while (out.length < MIN_SUBMIT_CASES) {
    const c = cases[i % cases.length];
    out.push({ input: c.input, expectedOutput: c.expectedOutput });
    i += 1;
  }
  return out;
}

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
    const testCases = padTestCases(p.testCases);

    await query(
      `INSERT INTO problems (slug, title, description, difficulty, test_cases, starter_code, topics, companies)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         difficulty = EXCLUDED.difficulty,
         test_cases = EXCLUDED.test_cases,
         starter_code = EXCLUDED.starter_code,
         topics = EXCLUDED.topics,
         companies = EXCLUDED.companies`,
      [
        p.slug,
        p.title,
        p.description,
        p.difficulty,
        JSON.stringify(testCases),
        JSON.stringify(starterCode),
        p.topics,
        p.companies,
      ]
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