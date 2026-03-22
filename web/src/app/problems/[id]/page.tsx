"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api, ProblemDetail } from "@/lib/api";

type SubmissionResult = {
  status: string;
  passed: boolean;
  results: Array<{ passed: boolean }>;
  runtimeMs?: number;
};

export default function ProblemDetailPage() {
  const params = useParams<{ id: string }>();
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("# Write your solution here\n");
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    api
      .getProblem(params.id)
      .then((res) => setProblem(res.problem))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load problem";
        toast.error(msg);
        setError(msg);
      });
  }, [params.id]);

  const runSubmission = async () => {
    if (!problem) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.submitCode(problem.id, language, code);
      setResult({
        status: res.status,
        passed: res.passed,
        results: res.results,
        runtimeMs: res.runtimeMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Protected>
      <PageShell>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h1 className="mb-2 text-2xl font-semibold">{problem?.title ?? "Loading..."}</h1>
            <p className="mb-4 whitespace-pre-wrap text-sm text-text-secondary">{problem?.description}</p>
            <h2 className="mb-2 text-sm font-semibold">Sample test cases</h2>
            <ul className="space-y-2 text-xs text-text-secondary">
              {(problem?.test_cases ?? []).slice(0, 3).map((tc, idx) => (
                <li className="rounded-lg border border-border bg-background p-2" key={idx}>
                  <div>Input: {tc.input}</div>
                  <div>Expected: {tc.expectedOutput}</div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="bg-black">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Editor</h2>
              <select
                className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="python">python</option>
                <option value="cpp">cpp</option>
                <option value="c">c</option>
                <option value="java">java</option>
              </select>
            </div>
            <textarea
              className="mono mb-3 h-[320px] w-full rounded-lg border border-border bg-black p-3 text-sm text-green-400"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={runSubmission} disabled={loading}>
                {loading ? "Running..." : "Run / Submit"}
              </Button>
            </div>
            {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
            {result ? (
              <div className="mono mt-3 rounded-lg border border-border bg-black p-3 text-sm text-green-400">
                <p>status: {result.status}</p>
                <p>passed: {String(result.passed)}</p>
                <p>runtimeMs: {result.runtimeMs ?? "n/a"}</p>
                <p>tests passed: {result.results.filter((r) => r.passed).length}</p>
              </div>
            ) : null}
          </Card>
        </div>
      </PageShell>
    </Protected>
  );
}
