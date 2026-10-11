import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { OutputDiff } from "@/components/output-diff";
import type { CustomCaseResult } from "@/lib/api";

export type CustomCase = { id: string; input: string };
export function CustomCases({
  cases,
  errors,
  firstInput,
  onChange,
  inputRefs,
  disabled,
}: {
  cases: CustomCase[];
  errors: Record<string, string>;
  firstInput: string;
  onChange: (cases: CustomCase[]) => void;
  inputRefs: RefObject<Record<string, HTMLTextAreaElement | null>>;
  disabled: boolean;
}) {
  return (
    <section className="space-y-3 pt-3" aria-labelledby="custom-cases-heading">
      <h2 id="custom-cases-heading" className="text-sm font-semibold">
        Your cases
      </h2>
      <p className="text-xs text-text-secondary">
        Use the examples&apos; input format. For design problems, put operations
        and arguments on separate lines. Custom cases run against the reference
        solution.
      </p>
      {cases.map((item, index) => (
        <div
          key={item.id}
          className="space-y-2 rounded-xl border border-border bg-surface/60 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={`custom-${item.id}`}
              className="text-xs font-semibold"
            >
              Custom case {index + 1}
            </label>
            <button
              type="button"
              disabled={disabled}
              className="min-h-8 rounded px-2 text-xs text-primary underline"
              aria-label={`Remove custom case ${index + 1}`}
              onClick={() => onChange(cases.filter((c) => c.id !== item.id))}
            >
              Remove
            </button>
          </div>
          <textarea
            id={`custom-${item.id}`}
            ref={(node) => {
              inputRefs.current[item.id] = node;
            }}
            value={item.input}
            maxLength={10000}
            disabled={disabled}
            rows={3}
            aria-invalid={Boolean(errors[item.id])}
            aria-describedby={`custom-${item.id}-count${errors[item.id] ? ` custom-${item.id}-error` : ""}`}
            onChange={(event) =>
              onChange(
                cases.map((c) =>
                  c.id === item.id ? { ...c, input: event.target.value } : c,
                ),
              )
            }
            className="mono w-full min-w-0 resize-y rounded-lg border border-border bg-background p-2 text-xs text-text-primary"
          />
          <p
            id={`custom-${item.id}-count`}
            className="text-xs text-text-secondary"
          >
            {item.input.length.toLocaleString()}/10,000 characters
          </p>
          {errors[item.id] && (
            <p
              id={`custom-${item.id}-error`}
              className="text-xs text-error"
              role="alert"
            >
              {errors[item.id]}
            </p>
          )}
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || cases.length >= 10}
        onClick={() =>
          onChange([...cases, { id: crypto.randomUUID(), input: firstInput }])
        }
      >
        Add custom case
      </Button>
      {cases.length === 10 && (
        <p className="text-xs text-text-secondary">
          Maximum of 10 custom cases.
        </p>
      )}
    </section>
  );
}

export function CustomResults({ results }: { results: CustomCaseResult[] }) {
  if (!results.length) return null;
  return (
    <section className="space-y-2" aria-label="Your case results">
      <h2 className="text-sm font-semibold">Your cases</h2>
      {results.map((result, index) => (
        <div
          key={index}
          className="space-y-1 rounded-xl border border-border bg-surface/60 p-3 text-xs"
        >
          <p className="font-semibold">
            Case {index + 1}:{" "}
            {result.judged
              ? result.passed
                ? "Passed"
                : "Failed"
              : `Not judged: ${result.inputError ?? "No reference output available"}`}
          </p>
          <pre className="mono whitespace-pre-wrap break-all">
            Input: {result.input}
          </pre>
          {result.judged && (
            <pre className="mono whitespace-pre-wrap break-all">
              Expected (reference solution): {result.expectedOutput}
            </pre>
          )}
          {result.actualOutput !== undefined && (
            <pre className="mono whitespace-pre-wrap break-all">
              Output: {result.actualOutput}
            </pre>
          )}
          {result.error && (
            <pre className="mono whitespace-pre-wrap break-all">
              Error: {result.error}
            </pre>
          )}
          {result.diff && <OutputDiff diff={result.diff} />}
        </div>
      ))}
    </section>
  );
}
