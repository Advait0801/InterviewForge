import type { AgentNote, Challenge, Evaluation } from "@/lib/api";

export function QuestionDetails({ challenge, agent }: { challenge?: Challenge; agent?: AgentNote }) {
  return <>
    {challenge && <div role="note" aria-label="Pushback" className="mb-3 space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
      <p className="font-semibold">Pushback</p>
      <p className="text-xs font-semibold text-text-secondary">What you said</p>
      <blockquote className="break-words">“{challenge.claim}”</blockquote>
      <p className="text-xs font-semibold text-text-secondary">What the reference says</p>
      <blockquote className="break-words">“{challenge.evidence}”</blockquote>
    </div>}
    {agent && <details className="mb-3 text-sm">
      <summary className="cursor-pointer rounded py-1 font-medium text-text-secondary">Why this question?</summary>
      <p className="mt-2 break-words leading-relaxed">{agent.rationale}</p>
      {agent.searches > 0 && <p className="mt-1 text-xs text-text-secondary">Looked up {agent.searches} sources</p>}
    </details>}
  </>;
}

export function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  return <div className="space-y-2">
    <p className="font-semibold">{evaluation.score}/10{evaluation.hintPenalty !== undefined && evaluation.hintPenalty > 0 && evaluation.rawScore !== undefined &&
      ` (${evaluation.rawScore} before a ${evaluation.hintPenalty}-point hint penalty)`}</p>
    {evaluation.hintsUsed !== undefined && evaluation.hintsUsed > 0 && <p className="text-xs text-text-secondary">{evaluation.hintsUsed} {evaluation.hintsUsed === 1 ? "hint" : "hints"} used</p>}
    {(["strengths", "weaknesses", "suggestions"] as const).map((key) => evaluation[key].length > 0 && <div key={key}>
      <p className="text-xs font-semibold capitalize">{key}</p>
      <ul className="list-inside list-disc space-y-1">{evaluation[key].map((text, i) => <li key={i}>{text}</li>)}</ul>
    </div>)}
  </div>;
}
