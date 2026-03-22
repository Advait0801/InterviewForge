import { Router } from "express";
import { runCode } from "../runner";
import { TestCase, SupportedLanguage } from "../types";

const router = Router();

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["python3", "c", "cpp", "java"];

router.post("/run", async (req, res) => {
  const { language, code, testCases, slug } = req.body as {
    language?: string;
    code?: string;
    testCases?: TestCase[];
    slug?: string;
  };

  if (!language || !code || !Array.isArray(testCases)) {
    return res.status(400).json({
      error: "language, code, and testCases (array) are required",
    });
  }

  if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
    return res.status(400).json({
      error: `language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`,
    });
  }

  try {
    const result = await runCode({
      language: language as SupportedLanguage,
      code,
      testCases,
      slug,
    });
    return res.json(result);
  } catch (err) {
    console.error("Run error", err);
    return res.status(500).json({ error: "Execution failed" });
  }
});

export default router;