import { Router } from "express";
import { runCode } from "../runner";
import { PROBLEM_META } from "../problem-meta";
import { validateInput } from "../validate-input";
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

export default router;
