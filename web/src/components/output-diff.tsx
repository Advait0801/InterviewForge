import type { OutputDiff as Diff } from "@/lib/api";

function pathLabel(path: number[]) {
  return path.length
    ? path.map((index) => `[${index}]`).join("")
    : "the whole output";
}
function valueLabel(value: unknown) {
  return JSON.stringify(value);
}
function MarkedString({ value, index }: { value: string; index: number }) {
  return (
    <span className="mono whitespace-pre-wrap break-all">
      {value.slice(0, index)}
      <mark className="rounded bg-warning/25 px-0.5 text-text-primary">
        {value[index] ?? "(end of string)"}
      </mark>
      {value.slice(index + 1)}
    </span>
  );
}

/** Only explains the server's diff; never parses or judges the user's output. */
export function OutputDiff({ diff }: { diff: Diff }) {
  let content;
  switch (diff.kind) {
    case "format":
      content = (
        <p>
          The output isn&apos;t valid JSON — check for extra print statements.
        </p>
      );
      break;
    case "type":
      content = (
        <p>
          Expected{" "}
          {diff.expectedType === "array" ? "an array" : diff.expectedType}, got{" "}
          {diff.actualType} at {pathLabel(diff.path)}.
        </p>
      );
      break;
    case "length":
      content = (
        <p>
          Expected {diff.expectedLength} items, got {diff.actualLength} at{" "}
          {pathLabel(diff.path)}.
        </p>
      );
      break;
    case "items":
      content = (
        <>
          <p>
            Missing: {valueLabel(diff.missing)} · Unexpected:{" "}
            {valueLabel(diff.unexpected)}
          </p>
          <p>
            Expected {diff.expectedLength} items, got {diff.actualLength}{" "}
            (order-independent comparison).
          </p>
        </>
      );
      break;
    case "value":
      content =
        typeof diff.expected === "string" &&
        typeof diff.actual === "string" &&
        diff.charIndex !== undefined ? (
          <>
            <p>
              At {pathLabel(diff.path)}: first difference at character{" "}
              {diff.charIndex + 1}.
            </p>
            <p>
              Expected:{" "}
              <MarkedString value={diff.expected} index={diff.charIndex} />
            </p>
            <p>
              Got: <MarkedString value={diff.actual} index={diff.charIndex} />
            </p>
          </>
        ) : (
          <p>
            First difference at {pathLabel(diff.path)}: expected{" "}
            {valueLabel(diff.expected)}, got {valueLabel(diff.actual)}.
          </p>
        );
  }
  return (
    <div className="mt-2 space-y-1 break-words rounded-lg border border-border bg-surface p-3 text-xs text-text-primary">
      {content}
    </div>
  );
}
