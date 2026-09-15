/**
 * Renders a problem editorial. Editorials are stored as plain text with fixed section
 * headings (written by backend/scripts/seed_problems.ts):
 *
 *   Approach / Key steps (numbered lines) / Complexity (Time: … / Space: …)
 *
 * Blocks are separated by a blank line and a block's first line is its heading. Anything
 * that doesn't follow the format is shown as plain text, so an older or hand-written
 * editorial still reads correctly.
 */

type Section = { heading: string | null; lines: string[] };

const HEADINGS = new Set(["Approach", "Key steps", "Complexity"]);
const STEP = /^(\d+)\.\s+(.*)$/;
const METRIC = /^(Time|Space):\s*(.*)$/;

/** Split "O(max(m, n)) for the output" into ["O(max(m, n))", "for the output"], respecting nested parens. */
export function splitComplexity(value: string): [string, string] {
  if (!value.startsWith("O(")) return [value, ""];
  let depth = 0;
  for (let i = 1; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")" && --depth === 0) {
      return [value.slice(0, i + 1), value.slice(i + 1).replace(/^[,;]?\s*/, "")];
    }
  }
  return [value, ""];
}

export function parseEditorial(text: string): Section[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      return HEADINGS.has(lines[0]) ? { heading: lines[0], lines: lines.slice(1) } : { heading: null, lines };
    })
    .filter((s) => s.lines.length > 0);
}

function SectionBody({ lines }: { lines: string[] }) {
  if (lines.every((l) => STEP.test(l))) {
    return (
      <ol className="space-y-2">
        {lines.map((l, i) => {
          const [, n, body] = l.match(STEP)!;
          return (
            <li key={i} className="flex gap-3">
              <span className="mono mt-px w-5 shrink-0 text-right text-xs font-semibold text-primary">{n}.</span>
              <span>{body}</span>
            </li>
          );
        })}
      </ol>
    );
  }
  if (lines.every((l) => METRIC.test(l))) {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {lines.map((l, i) => {
          const [, label, value] = l.match(METRIC)!;
          const [bigO, note] = splitComplexity(value);
          return (
            <div key={i} className="contents">
              <dt className="text-xs font-semibold text-text-secondary">{label}</dt>
              <dd>
                <span className="mono rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">{bigO}</span>
                {note && <span className="ml-2 text-text-secondary">{note}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }
  return <p className="whitespace-pre-wrap">{lines.join("\n")}</p>;
}

export function EditorialView({ text }: { text: string | null | undefined }) {
  const sections = text?.trim() ? parseEditorial(text) : [];
  if (sections.length === 0) {
    return <p className="text-sm text-text-secondary">No editorial available for this problem yet.</p>;
  }
  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <section key={i} className="rounded-xl border border-border bg-surface/60 p-4">
          {s.heading && <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{s.heading}</h3>}
          <div className="text-sm leading-relaxed text-text-primary">
            <SectionBody lines={s.lines} />
          </div>
        </section>
      ))}
    </div>
  );
}
