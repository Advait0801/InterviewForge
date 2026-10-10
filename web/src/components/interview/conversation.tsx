import { useEffect, useRef } from "react";
import type { Evaluation, InterviewMessage } from "@/lib/api";
import type { QuestionPreview } from "./use-interview";
import { EvaluationCard, QuestionDetails } from "./question-details";

export function StreamingQuestion({ question, evaluation, busy, phase }: { question: QuestionPreview | null; evaluation: Evaluation | null; busy: boolean; phase: string }) {
  return <>
    {evaluation && <div className="max-w-3xl rounded-lg border border-secondary/30 bg-secondary/5 p-4 text-sm" aria-label="Answer evaluation"><EvaluationCard evaluation={evaluation} /></div>}
    {question && <div className="max-w-3xl rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm" data-testid="streamed-question">
      <QuestionDetails challenge={question.challenge} agent={question.agent} />
      <p className="mb-2 text-xs font-semibold uppercase text-text-secondary">{question.kind === "followup" ? "Follow-up" : "Question"}</p>
      <p className="whitespace-pre-wrap break-words leading-relaxed">{question.text}</p>
    </div>}
    {busy && <p className="text-sm text-text-secondary" role="status">{phase}</p>}
  </>;
}

export function Conversation({ messages, preview, evaluation, busy, phase, announcement }: {
  messages: InterviewMessage[]; preview: QuestionPreview | null; evaluation: Evaluation | null; busy: boolean; phase: string; announcement: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pane = scrollRef.current;
    pane?.scrollTo({ top: pane.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [messages.length, announcement]);
  return <>
    <div ref={scrollRef} tabIndex={0} role="region" aria-label="Interview conversation" className="max-h-[min(65vh,680px)] min-h-[300px] space-y-3 overflow-y-auto border-y border-border py-4">
      {messages.map((message, index) => {
        const metadata = message.metadata_json;
        const hint = metadata.kind === "hint";
        const question = metadata.kind === "question" || metadata.kind === "followup";
        return <div key={message.id}>
          {index > 0 && messages[index - 1].stage !== message.stage && message.role === "assistant" && <p className="my-4 text-xs font-bold uppercase text-primary">{message.stage.replaceAll("_", " ")}</p>}
          <div className={`max-w-3xl rounded-lg border p-4 text-sm ${hint ? "border-warning/40 bg-warning/5" : message.role === "assistant" ? "border-primary/30 bg-primary/5" : message.role === "candidate" ? "border-border bg-surface/60" : "border-secondary/30 bg-secondary/5"}`}>
            <p className="mb-2 text-xs font-semibold uppercase text-text-secondary">{hint ? `Hint ${metadata.level}/3` : `${message.role} · ${metadata.kind}`}</p>
            {question && <QuestionDetails agent={metadata.agent} challenge={metadata.kind === "followup" ? metadata.challenge : undefined} />}
            {metadata.kind === "evaluation" ? <EvaluationCard evaluation={metadata} /> : <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>}
            {hint && <p className="mt-2 text-xs text-text-secondary">Each hint costs 1 point off this answer’s score.</p>}
          </div>
        </div>;
      })}
      <StreamingQuestion question={preview} evaluation={evaluation} busy={busy} phase={phase} />
      {messages.length === 0 && !busy && !preview && <p className="text-sm text-text-secondary">No conversation messages yet. Refresh the conversation to load the current question.</p>}
    </div>
  </>;
}
