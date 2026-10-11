"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { InterviewReplay, ReplayEvent, ReplayReport } from "@/lib/api";

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function offsetLabel(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function FeedbackLists({
  strengths,
  weaknesses,
  suggestions,
  report = false,
}: {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  report?: boolean;
}) {
  const Heading = report ? "h3" : "h4";
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["Strengths", strengths],
        ["Weaknesses", weaknesses],
        ["Suggestions", suggestions],
      ].map(([label, items]) => (
        <div key={String(label)}>
          <Heading className="text-xs font-semibold">{label}</Heading>
          <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-text-secondary">
            {(items as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
function EventCard({ event }: { event: ReplayEvent }) {
  return (
    <article className="space-y-3 break-words rounded-xl border border-border bg-surface/70 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <time className="mono text-text-secondary">
          {offsetLabel(event.offsetSeconds)}
        </time>
        <h3 className="font-semibold capitalize">
          {event.type === "hint"
            ? `Hint ${event.level}`
            : event.type === "followup"
              ? "Follow-up"
              : event.type}
        </h3>
        {(event.type === "question" || event.type === "followup") &&
          event.pushback && (
            <span className="rounded-full border border-border px-2 py-0.5">
              Pushed back
            </span>
          )}
      </div>
      {event.type === "evaluation" ? (
        <>
          <p className="font-semibold">
            Score: {event.evaluation.score}/10
            {event.evaluation.rawScore !== undefined && (
              <span className="text-sm font-normal text-text-secondary">
                {" "}
                · Before hints: {event.evaluation.rawScore}/10
              </span>
            )}
          </p>
          {event.evaluation.hintPenalty !== undefined &&
            event.evaluation.hintPenalty > 0 && (
              <p className="text-sm text-text-secondary">
                Hint penalty: {event.evaluation.hintPenalty} ·{" "}
                {event.evaluation.hintsUsed ?? 0} hints used
              </p>
            )}
          <FeedbackLists
            strengths={event.evaluation.strengths}
            weaknesses={event.evaluation.weaknesses}
            suggestions={event.evaluation.suggestions}
          />
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {event.text}
        </p>
      )}
    </article>
  );
}
export function ReplayReportView({ report }: { report: ReplayReport }) {
  return (
    <section
      aria-labelledby="replay-report-heading"
      className="space-y-4 rounded-2xl border border-border bg-surface/70 p-5"
    >
      <h2 id="replay-report-heading" className="text-xl font-semibold">
        Interview report
      </h2>
      <p className="text-lg font-bold">
        Overall score: {report.overallScore}/10
      </p>
      <dl className="space-y-3">
        {Object.entries(report.stageScores).map(([stage, score]) => (
          <div key={stage}>
            <dt className="font-semibold capitalize">
              {stage.replaceAll("_", " ")} · {score.score}/10
            </dt>
            <dd className="mt-1 text-sm text-text-secondary">
              {score.feedback}
            </dd>
          </div>
        ))}
      </dl>
      <FeedbackLists
        report
        strengths={report.strengths}
        weaknesses={report.weaknesses}
        suggestions={report.recommendations}
      />
    </section>
  );
}
export function ReplayTimeline({ replay }: { replay: InterviewReplay }) {
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const [visible, setVisible] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const events = replay.events;
  const count = reduced || visible === null ? events.length : visible;
  useEffect(() => {
    if (!playing || reduced || visible === null || visible >= events.length)
      return;
    const gap =
      events[visible].offsetSeconds - (events[visible - 1]?.offsetSeconds ?? 0);
    const delay = Math.min(2000, Math.max(100, gap * 100)) / speed;
    const timer = setTimeout(() => {
      setVisible(visible + 1);
      if (visible + 1 >= events.length) setPlaying(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [playing, reduced, visible, events, speed]);
  const stages = [
    ...new Set([...replay.stages, ...events.map((event) => event.stage)]),
  ];
  return (
    <div className="space-y-6">
      <section
        aria-label="Replay controls"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
      >
        <Button
          size="sm"
          disabled={reduced || playing || !events.length}
          onClick={() => {
            if (visible === null || count >= events.length) setVisible(1);
            setPlaying(true);
          }}
        >
          Play
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!playing || reduced}
          onClick={() => setPlaying(false)}
        >
          Pause
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPlaying(false);
            setVisible(null);
          }}
        >
          Show all
        </Button>
        <label className="flex items-center gap-2 text-sm">
          Speed
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            className="rounded-lg border border-border bg-surface p-2"
          >
            {[1, 2, 4].map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-text-secondary">
          {reduced
            ? "Reduced motion: all events shown."
            : `${count}/${events.length} events · pauses compressed to at most 2 seconds`}
        </p>
      </section>
      {!events.length && (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-text-secondary">
          No replay events are available yet.
        </p>
      )}
      {stages.map((stage) => {
        const stageEvents = events
          .slice(0, count)
          .map((event, index) => ({ event, index }))
          .filter((item) => item.event.stage === stage);
        if (!stageEvents.length) return null;
        return (
          <section
            key={stage}
            className="space-y-3"
            aria-label={`${stage.replaceAll("_", " ")} timeline`}
          >
            <h2 className="text-xl font-semibold capitalize">
              {stage.replaceAll("_", " ")}
            </h2>
            <ol className="space-y-3">
              {stageEvents.map(({ event, index }) => (
                <li key={index}>
                  <EventCard event={event} />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {replay.report ? (
        <ReplayReportView report={replay.report} />
      ) : (
        <p className="text-sm text-text-secondary">
          No report has been generated yet.
        </p>
      )}
    </div>
  );
}
