import { Router } from "express";
import { runCode } from "../runner";
import { PROBLEM_META } from "../problem-meta";
import { validateInput } from "../validate-input";
import { complexitySupported, measureComplexity, supportedSlugs } from "../complexity";
import { SUPPORTED_LANGUAGES, type SupportedLanguage, type TestCase } from "../types";

const router = Router();

const isLanguage = (l: unknown): l is SupportedLanguage =>
  typeof l === "string" && (SUPPORTED_LANGUAGES as string[]).includes(l);

router.post("/run", async (req, res) => {
  const { language, code, testCases, slug, customCases } = req.body as {
    language?: string;
    code?: string;
    testCases?: TestCase[];
    slug?: string;
    customCases?: { inputs?: unknown; reference?: { language?: unknown; code?: unknown } };
  };

  if (!language || !code || !Array.isArray(testCases)) {
    return res.status(400).json({
      error: "language, code, and testCases (array) are required",
    });
  }

  if (!isLanguage(language)) {
    return res.status(400).json({
      error: `language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`,
    });
  }

  if (
    customCases !== undefined &&
    (!Array.isArray(customCases.inputs) ||
      !customCases.inputs.every((i) => typeof i === "string") ||
      !isLanguage(customCases.reference?.language) ||
      typeof customCases.reference?.code !== "string")
  ) {
    return res.status(400).json({ error: "customCases needs inputs (strings) and a reference { language, code }" });
  }

  try {
    const result = await runCode({
      language,
      code,
      testCases,
      slug,
      customCases: customCases as { inputs: string[]; reference: { language: SupportedLanguage; code: string } } | undefined,
    });
    return res.json(result);
  } catch (err) {
    console.error("Run error", err);
    return res.status(500).json({ error: "Execution failed" });
  }
});

/**
 * Check custom inputs against a problem's signature. No sandbox: the backend
 * calls this before queueing a run, so a typo is a 400 rather than a queue slot.
 */
router.post("/validate", (req, res) => {
  const { slug, inputs } = req.body as { slug?: unknown; inputs?: unknown };
  if (typeof slug !== "string" || !Array.isArray(inputs) || !inputs.every((i) => typeof i === "string")) {
    return res.status(400).json({ error: "slug and inputs (array of strings) are required" });
  }
  const meta = PROBLEM_META[slug];
  if (!meta) return res.status(404).json({ error: `Unknown problem "${slug}"` });
  return res.json({ errors: (inputs as string[]).map((input) => validateInput(input, meta)) });
});

/** The problems a complexity measurement is available for (curated inputs, Phase 12). */
router.get("/complexity/problems", (_req, res) => res.json({ slugs: supportedSlugs() }));

/**
 * Time the user's code on inputs doubling in size. One sandbox, up to COMPLEXITY_TIMEOUT_MS;
 * the backend queues it like any run and fits the curve.
 */
router.post("/complexity", async (req, res) => {
  const { language, code, slug } = req.body as { language?: unknown; code?: unknown; slug?: unknown };
  if (!isLanguage(language) || typeof code !== "string" || !code || typeof slug !== "string") {
    return res.status(400).json({ error: "language, code and slug are required" });
  }
  if (!PROBLEM_META[slug]) return res.status(404).json({ error: `Unknown problem "${slug}"` });
  if (!complexitySupported(slug)) return res.status(422).json({ error: "Complexity measurement isn't available for this problem" });
  try {
    return res.json(await measureComplexity({ language, code, slug }));
  } catch (err) {
    console.error("Complexity error", err);
    return res.status(500).json({ error: "Measurement failed" });
  }
});

export default router;
