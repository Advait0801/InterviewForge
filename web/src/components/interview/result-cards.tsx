import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { InterviewMessage, InterviewReport, VoiceEvaluation } from "@/lib/api";
import { downloadInterviewPdf } from "@/lib/interviewPdf";

function ScoreBar({ label, score, notes }: { label: string; score: number; notes: string }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "bg-accent" : score >= 4 ? "bg-warning" : "bg-error";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-bold">{score}/10</span>
      </div>
      <div className="h-2 rounded-full bg-border">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      {notes && <p className="mt-0.5 text-[10px] text-text-secondary">{notes}</p>}
    </div>
  );
}

export function VoiceEvalCard({ evaluation, onClose }: { evaluation: VoiceEvaluation; onClose: () => void }) {
  const overallColor = evaluation.overallScore >= 7 ? "text-accent" : evaluation.overallScore >= 4 ? "text-warning" : "text-error";
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Voice Evaluation</h2>
          <span className={`text-lg font-bold ${overallColor}`}>{evaluation.overallScore}/10</span>
        </div>
        <button type="button" aria-label="Close voice evaluation" onClick={onClose} className="rounded-lg p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M3 11L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="space-y-3">
        <ScoreBar label="Technical Correctness" score={evaluation.technicalCorrectness.score} notes={evaluation.technicalCorrectness.notes} />
        <ScoreBar label="Communication Clarity" score={evaluation.communicationClarity.score} notes={evaluation.communicationClarity.notes} />
        <ScoreBar label="Completeness" score={evaluation.completeness.score} notes={evaluation.completeness.notes} />
      </div>

      {evaluation.strengths.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-accent">Strengths</p>
          <ul className="space-y-0.5 text-xs text-text-secondary">
            {evaluation.strengths.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-accent">+</span>{s}</li>)}
          </ul>
        </div>
      )}

      {evaluation.weaknesses.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-error">Weaknesses</p>
          <ul className="space-y-0.5 text-xs text-text-secondary">
            {evaluation.weaknesses.map((w, i) => <li key={i} className="flex gap-1.5"><span className="text-error">-</span>{w}</li>)}
          </ul>
        </div>
      )}

      {evaluation.suggestions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-secondary">Suggestions</p>
          <ul className="space-y-0.5 text-xs text-text-secondary">
            {evaluation.suggestions.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-secondary">*</span>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  behavioral: "Behavioral",
  coding: "Coding",
  system_design: "System Design",
  core_cs: "Core CS",
};

export function InterviewReportCard({
  report,
  messages,
  companyLabel,
}: {
  report: InterviewReport;
  messages: InterviewMessage[];
  companyLabel: string;
}) {
  const overallColor = report.overallScore >= 7 ? "text-accent" : report.overallScore >= 4 ? "text-warning" : "text-error";
  return (
    <div className="rounded-xl border border-primary/30 bg-surface/80 p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold">Interview Report</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary">Overall:</span>
          <span className={`text-2xl font-bold ${overallColor}`}>{report.overallScore}/10</span>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 touch-manipulation"
            onClick={() => {
              try {
                downloadInterviewPdf({ report, messages, companyLabel });
                toast.success("PDF downloaded");
              } catch {
                toast.error("Could not build PDF");
              }
            }}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {report.stageScores && Object.keys(report.stageScores).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">Stage Scores</h3>
          {Object.entries(report.stageScores).map(([stage, data]) => (
            <div key={stage}>
              <ScoreBar
                label={STAGE_LABELS[stage] || stage}
                score={typeof data.score === "string" ? parseInt(data.score, 10) : data.score}
                notes={data.feedback || ""}
              />
            </div>
          ))}
        </div>
      )}

      {report.strengths?.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold text-accent">Strengths</h3>
          <ul className="space-y-1 text-sm text-text-secondary">
            {report.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-accent">+</span>{s}</li>)}
          </ul>
        </div>
      )}

      {report.weaknesses?.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold text-error">Areas for Improvement</h3>
          <ul className="space-y-1 text-sm text-text-secondary">
            {report.weaknesses.map((w, i) => <li key={i} className="flex gap-2"><span className="text-error">-</span>{w}</li>)}
          </ul>
        </div>
      )}

      {report.recommendations?.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-semibold text-secondary">Recommendations</h3>
          <ul className="space-y-1 text-sm text-text-secondary">
            {report.recommendations.map((r, i) => <li key={i} className="flex gap-2"><span className="text-secondary">*</span>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
