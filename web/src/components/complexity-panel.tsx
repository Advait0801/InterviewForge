"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiError, type ComplexityAnalysis } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";

const verdicts: Record<ComplexityAnalysis["claim"]["verdict"], string> = {
  agrees: "The measurement found exactly this.",
  consistent: "One of the classes the data allows.",
  log_factor: "Differs only by a log factor.",
  disagrees: "The measured classes disagree with this claim.",
  not_comparable: "No claim yet or nothing measured that can be compared.",
};
function time(ns: number) {
  return ns < 1_000_000
    ? `${(ns / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} µs`
    : `${(ns / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} ms`;
}
const subscribe = (change: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

export function ComplexityResult({
  analysis,
}: {
  analysis: ComplexityAnalysis;
}) {
  const reducedMotion = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const { fit } = analysis;
  const points = fit.points
    .filter((p) => p.n > 0 && p.ns > 0)
    .map((p) => ({ n: p.n, time: p.ns / 1000 }));
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-lg font-semibold">
        {fit.candidates.join(" or ") || "Inconclusive measurement"}
      </h3>
      {fit.status === "measured" && (
        <p className="text-sm text-text-secondary">
          {fit.confidence} confidence
        </p>
      )}
      {fit.status === "measured" && fit.candidates.length > 1 && (
        <p className="text-sm text-text-secondary">
          At these sizes, memory effects are as large as a log factor, so the
          measurement can&apos;t tell them apart.
        </p>
      )}
      {fit.status === "inconclusive" && (
        <p className="text-sm text-text-secondary">
          {fit.reason === "too_fast"
            ? "Runs in microseconds at every size: constant or logarithmic."
            : "Not enough sizes finished to measure complexity."}
        </p>
      )}
      {analysis.stopped === "time_limit" && (
        <p className="text-sm text-text-secondary">
          The largest sizes didn&apos;t finish in 20 s. This fit uses the sizes
          that completed.
        </p>
      )}
      {analysis.stopped === "error" && (
        <p role="alert" className="break-words text-sm text-error">
          {analysis.error ?? "Execution failed"}
          {analysis.errorAtN !== null
            ? ` at n = ${analysis.errorAtN.toLocaleString()}`
            : ""}
          .
        </p>
      )}
      {points.length > 0 && (
        <div aria-hidden="true" className="h-56 min-w-0 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              accessibilityLayer={false}
              data={points}
              margin={{ top: 10, right: 16, bottom: 12, left: 0 }}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="n"
                scale="log"
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="time"
                scale="log"
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                width={50}
              />
              <Tooltip
                formatter={(v) => [`${Number(v).toLocaleString()} µs`, "Time"]}
              />
              <Line
                dataKey="time"
                stroke="var(--primary)"
                strokeWidth={2}
                isAnimationActive={!reducedMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs text-text-secondary">
        Input size (n) against time (µs); both chart axes use a logarithmic
        scale.
      </p>
      {fit.points.length ? (
        <table className="w-full text-left text-sm">
          <caption className="pb-2 text-left font-semibold">
            Measured times
          </caption>
          <thead>
            <tr>
              <th scope="col" className="py-1">
                Input size (n)
              </th>
              <th scope="col" className="py-1">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {fit.points.map((p) => (
              <tr key={p.n} className="border-t border-border">
                <th scope="row" className="py-1 font-normal">
                  {p.n.toLocaleString()}
                </th>
                <td>{time(p.ns)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-text-secondary">
          No timings were collected.
        </p>
      )}
      <div className="border-t border-border pt-3">
        <h3 className="font-semibold">AI reviewer comparison</h3>
        {analysis.claim.text && (
          <p className="break-words text-sm">Claim: {analysis.claim.text}</p>
        )}
        <p className="text-sm text-text-secondary">
          {verdicts[analysis.claim.verdict]}
        </p>
      </div>
      <p className="text-xs text-text-secondary">
        Measured {new Date(analysis.measuredAt).toLocaleString()}
      </p>
    </div>
  );
}

export function ComplexityPanel({
  submissionId,
  reviewVersion = 0,
}: {
  submissionId: string;
  reviewVersion?: number;
}) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof api.getComplexity>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"measure" | "review" | null>(null);
  const [error, setError] = useState<{
    message: string;
    retry: boolean;
    kind?: "measure" | "review";
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getComplexity(submissionId, current.signal);
      if (!current.signal.aborted) setData(response);
    } catch (e) {
      if (!current.signal.aborted)
        setError({
          message:
            e instanceof Error ? e.message : "Could not load complexity.",
          retry: true,
        });
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, [submissionId]);
  useEffect(() => {
    setData(null);
    setBusy(null);
    void load();
    return () => controller.current?.abort();
  }, [load, reviewVersion]);
  async function run(kind: "measure" | "review") {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(kind);
    setError(null);
    try {
      if (kind === "measure") {
        const response = await api.measureComplexity(
          submissionId,
          current.signal,
        );
        if (!current.signal.aborted)
          setData({ available: true, analysis: response.analysis });
      } else {
        await api.reviewSubmission(submissionId, current.signal);
        const response = await api.getComplexity(submissionId, current.signal);
        if (!current.signal.aborted) setData(response);
      }
    } catch (e) {
      if (!current.signal.aborted)
        setError({
          message: e instanceof Error ? e.message : "The request failed.",
          kind,
          retry:
            e instanceof ApiError
              ? e.status === 503 && e.retryable === true
              : true,
        });
    } finally {
      if (!current.signal.aborted) setBusy(null);
    }
  }
  if (loading)
    return (
      <LoadingState
        label="Checking complexity availability"
        className="min-h-20"
      />
    );
  if (!data && error)
    return (
      <StatePanel
        tone="error"
        title="Complexity unavailable"
        description={error.message}
        action={<Button onClick={load}>Retry complexity</Button>}
      />
    );
  if (!data?.available)
    return (
      <p className="text-sm text-text-secondary">
        Empirical complexity is unavailable for this problem.
      </p>
    );
  return (
    <Card className="min-w-0 space-y-3">
      <h2 className="font-semibold">Empirical time complexity</h2>
      {data.analysis && <ComplexityResult analysis={data.analysis} />}
      {busy && (
        <p role="status" className="text-sm text-text-secondary">
          {busy === "measure"
            ? "Timing your code on doubling input sizes. This can take about 25 seconds; you can keep using the page."
            : "Running the AI review and comparing its claim with your measurement…"}
        </p>
      )}
      {error && (
        <StatePanel
          tone="error"
          title="Complexity request failed"
          description={error.message}
          action={
            error.retry ? (
              <Button onClick={() => run(error.kind ?? "measure")}>
                {error.kind === "review"
                  ? "Retry AI review"
                  : "Retry measurement"}
              </Button>
            ) : undefined
          }
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => run("measure")}
          disabled={Boolean(busy)}
        >
          {data.analysis ? "Measure again" : "Measure time complexity"}
        </Button>
        {data.analysis && !data.analysis.claim.text && (
          <Button
            size="sm"
            variant="secondary"
            disabled={Boolean(busy)}
            onClick={() => run("review")}
          >
            Run AI review
          </Button>
        )}
        {busy && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              controller.current?.abort();
              setBusy(null);
            }}
          >
            Cancel request
          </Button>
        )}
      </div>
    </Card>
  );
}
