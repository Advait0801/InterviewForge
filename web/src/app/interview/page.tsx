"use client";

import { useState } from "react";
import Image from "next/image";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "sonner";
import { api, type InterviewReport, type VoiceEvaluation, type Persona, type InterviewMode } from "@/lib/api";
import { useSpeechRecording } from "@/hooks/use-speech-recording";
import { VoiceRecordingFeedback } from "@/components/voice-recording-feedback";
import { speechError, type SpeechError } from "@/lib/speech";
import { useInterview } from "@/components/interview/use-interview";
import { Preferences } from "@/components/interview/preferences";
import { Conversation, StreamingQuestion } from "@/components/interview/conversation";
import { Hints } from "@/components/interview/hints";
import { VoiceEvalCard, InterviewReportCard } from "@/components/interview/result-cards";

type Company = "amazon" | "google" | "meta" | "apple";
type Difficulty = "easy" | "medium" | "hard";

const COMPANIES: { value: Company; label: string; focus: string; color: string; logoSrc: string }[] = [
  { value: "amazon", label: "Amazon", focus: "Leadership principles, system design, and behavioral depth.", color: "border-warning hover:border-warning/70 hover:shadow-warning/10", logoSrc: "/logos/amazon.svg" },
  { value: "google", label: "Google", focus: "Algorithms, problem solving, and analytical thinking.", color: "border-secondary hover:border-secondary/70 hover:shadow-secondary/10", logoSrc: "/logos/google.svg" },
  { value: "meta", label: "Meta", focus: "Practical coding, system scalability, and move-fast culture.", color: "border-primary hover:border-primary/70 hover:shadow-primary/10", logoSrc: "/logos/meta.svg" },
  { value: "apple", label: "Apple", focus: "Product quality, fundamentals, and performance-focused execution.", color: "border-border-hover hover:border-border hover:shadow-surface-hover/30", logoSrc: "/logos/apple.svg" },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

/** Mirrors ai-service company_profiles focus_areas for lobby chips. */
const COMPANY_FOCUS_CHIPS: Record<Company, string[]> = {
  amazon: ["ownership", "customer obsession", "trade-offs", "scalability"],
  google: ["algorithms", "data structures", "clarity", "decomposition"],
  meta: ["execution", "scalability", "practicality", "product sense"],
  apple: ["product quality", "performance", "fundamentals", "execution"],
};

/** Short calibration lines per company + difficulty (aligned with backend difficulty_calibration). */
const DIFFICULTY_CALIBRATION_NOTES: Record<Company, Record<Difficulty, string>> = {
  amazon: {
    easy: "Expect SDE-style depth: clear STAR stories, basic data structures, simple trade-offs.",
    medium: "Expect SDE-II depth: stronger LPs, medium algorithms, scalable system sketches.",
    hard: "Expect senior depth: ambiguous ownership stories, hard algorithms, large-scale design.",
  },
  google: {
    easy: "L3-style: solid fundamentals, optimize from brute force, clear complexity talk.",
    medium: "L4-style: harder patterns, rigorous reasoning, back-of-envelope system design.",
    hard: "L5+-style: subtle optimizations, ambiguous constraints, deep distributed trade-offs.",
  },
  meta: {
    easy: "E3-style: ship working code fast, impact-focused stories, high-level system intuition.",
    medium: "E4-style: time pressure, graph/social patterns, real-time scale in design.",
    hard: "E5+-style: ambiguous product-scale problems, consistency vs latency under load.",
  },
  apple: {
    easy: "Strong fundamentals: readable code, ownership examples, reliability in design.",
    medium: "Higher quality bar: performance-aware coding, nuanced trade-offs, latency-focused design.",
    hard: "Senior bar: concurrency/memory depth, privacy and trust, ambiguous quality vs schedule.",
  },
};

const STAGES = [
  { key: "behavioral", label: "Behavioral", description: "Situational and leadership questions" },
  { key: "coding", label: "Coding", description: "Algorithm and data structure problems" },
  { key: "system_design", label: "System Design", description: "Architecture and scalability discussion" },
  { key: "core_cs", label: "Core CS", description: "Fundamentals and computer science concepts" },
];

function stageIndex(stage: string): number {
  const idx = STAGES.findIndex((s) => s.key === stage);
  return idx === -1 ? 0 : idx;
}

export default function InterviewPage() {
  const [selectedCompany, setSelectedCompany] = useState<Company>("google");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("medium");
  const [selectedPersona, setSelectedPersona] = useState<Persona>("neutral");
  const [selectedMode, setSelectedMode] = useState<InterviewMode | undefined>();
  const [hintBusy, setHintBusy] = useState(false);
  const interview = useInterview();
  const { sessionId, currentStage, sessionStatus, messages, answer, setAnswer, error, startError, syncPending, lastQuestion } = interview;
  const typing = interview.busy;
  const starting = !sessionId && typing;
  const [evaluatingVoice, setEvaluatingVoice] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [voiceEvaluationError, setVoiceEvaluationError] = useState<SpeechError | null>(null);
  const [voiceEval, setVoiceEval] = useState<VoiceEvaluation | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const speech = useSpeechRecording((text) => {
    setTranscript(text);
    setAnswer((previous) => previous ? `${previous}\n\n${text}` : text);
    setVoiceEvaluationError(null);
    setVoiceEval(null);
  });
  const { recording, transcribing, toggleRecording } = speech;

  const startSession = () => interview.startSession({ company: selectedCompany, difficulty: selectedDifficulty, persona: selectedPersona, mode: selectedMode });
  const submitAnswer = interview.submitAnswer;
  const refreshSession = interview.refreshSession;
  const setError = interview.setError;
  const questionPosition = messages.findIndex((message) => message.id === lastQuestion?.id);
  const currentHints = messages.slice(questionPosition + 1).filter((message) => message.metadata_json.kind === "hint");
  const questionsInStage = messages.filter((message) => message.stage === currentStage && (message.metadata_json.kind === "question" || message.metadata_json.kind === "followup")).length;

  const stageIdx = stageIndex(currentStage);
  const isCompleted = sessionStatus === "completed";

  return (
    <Protected>
      <PageShell>
        <div>
          <p className="sr-only" aria-live="polite" aria-atomic="true">{interview.announcement}</p>
          {!sessionId ? (
            /* ── Pre-session setup ── */
            <div className="space-y-8">
              <div>
                <h1 className="mb-2 text-3xl font-bold sm:text-4xl">Mock interview</h1>
                <p className="max-w-2xl text-text-secondary text-lg leading-relaxed">
                  Simulate a full multi-stage technical interview. Choose a company and difficulty, then work through
                  behavioral, coding, system design, and core CS rounds — just like the real thing.
                </p>
              </div>

              {/* Company selector */}
              <div>
                <h2 className="mb-3 text-lg font-semibold">Select Company</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {COMPANIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={selectedCompany === c.value}
                      disabled={starting}
                      onClick={() => setSelectedCompany(c.value)}
                      className={`rounded-lg border-2 p-4 text-left transition-colors ${c.color} ${
                        selectedCompany === c.value
                          ? "bg-surface"
                          : "border-border bg-surface/60"
                      }`}
                    >
                      <div className="inline-flex h-10 items-center">
                        <Image src={c.logoSrc} alt={`${c.label} logo`} width={120} height={36} className="h-8 w-auto object-contain" />
                      </div>
                      <p className="mt-2 mb-1 text-lg font-bold">{c.label}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{c.focus}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus chips for selected company */}
              <div>
                <h2 className="mb-3 text-lg font-semibold">
                  Focus for {COMPANIES.find((c) => c.value === selectedCompany)?.label ?? "company"}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {COMPANY_FOCUS_CHIPS[selectedCompany].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              {/* Difficulty selector */}
              <div>
                <h2 className="mb-3 text-lg font-semibold">Difficulty</h2>
                <div className="flex flex-wrap gap-3">
                  {DIFFICULTIES.map((d) => {
                    const diffColors: Record<string, string> = {
                      easy: "border-accent bg-accent/10 text-accent",
                      medium: "border-warning bg-warning/10 text-warning",
                      hard: "border-error bg-error/10 text-error",
                    };
                    return (
                      <button
                        key={d.value}
                        type="button"
                        aria-pressed={selectedDifficulty === d.value}
                        disabled={starting}
                        onClick={() => setSelectedDifficulty(d.value)}
                        className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors ${
                          selectedDifficulty === d.value
                            ? diffColors[d.value]
                            : "border-border text-text-secondary hover:border-border-hover"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary">
                  {DIFFICULTY_CALIBRATION_NOTES[selectedCompany][selectedDifficulty]}
                </p>
              </div>

              <Preferences persona={selectedPersona} mode={selectedMode} onPersona={setSelectedPersona} onMode={setSelectedMode} disabled={starting} />
              <StreamingQuestion question={interview.preview} evaluation={interview.evaluation} busy={starting} phase={interview.phase} />
              {starting && <Button variant="ghost" onClick={interview.cancel}>Cancel</Button>}
              {/* Stages overview */}
              <div>
                <h2 className="mb-3 text-lg font-semibold">Interview Stages</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {STAGES.map((s, i) => (
                    <Card key={s.key} className="relative">
                      <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 text-xs font-bold text-primary border border-primary/20">
                        {i + 1}
                      </span>
                      <h3 className="mb-1 font-semibold">{s.label}</h3>
                      <p className="text-xs text-text-secondary leading-relaxed">{s.description}</p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Start button */}
              <div className="flex flex-wrap items-center gap-4">
                <Button onClick={startSession} loading={starting} loadingLabel="Starting interview">
                  {startError ? "Retry interview" : "Start interview"}
                </Button>
                {startError && <p className="text-sm text-error" role="alert">{startError}</p>}
              </div>

              {/* Tips */}
              <div>
                <Card className="border-dashed">
                  <h3 className="mb-3 font-semibold text-text-secondary">Tips</h3>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-primary">▸</span>Think aloud — interviewers value your reasoning process.</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-primary">▸</span>Use the voice recorder to practice explaining solutions verbally.</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-primary">▸</span>Classic stages have up to 2 questions; Adaptive stages have up to 3.</li>
                  </ul>
                </Card>
              </div>
            </div>
          ) : (
            /* ── Active interview session ── */
            <div className="space-y-5">
              {/* Stage progress bar */}
              <div className="border-b border-border pb-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-lg font-bold">
                      {isCompleted
                        ? "Interview Complete"
                        : `Stage ${stageIdx + 1}/${STAGES.length}: ${STAGES[stageIdx]?.label ?? currentStage}`}
                    </h1>
                    <StatusPill
                      label={selectedCompany.charAt(0).toUpperCase() + selectedCompany.slice(1)}
                      tone="neutral"
                    />
                  </div>
                  <div className="flex items-center gap-2" role="status">
                    <StatusPill label={typing ? interview.phase : isCompleted ? "Done" : "Ready"} tone={isCompleted ? "success" : "neutral"} />
                    {recording && <StatusPill label="Recording" tone="warning" />}
                  </div>
                </div>
                {/* Stage stepper */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Interview stages">
                  {STAGES.map((s, i) => {
                    const done = i < stageIdx || isCompleted;
                    const active = i === stageIdx && !isCompleted;
                    return (
                      <div key={s.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-current={active ? "step" : undefined}>
                        <div className="flex w-full items-center gap-1">
                          <div
                            className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                              done ? "bg-accent" : active ? "bg-gradient-to-r from-primary to-secondary" : "bg-border"
                            }`}
                          />
                        </div>
                        <span className={`text-center text-xs font-semibold ${
                          active ? "text-primary" : done ? "text-accent" : "text-text-secondary"
                        }`}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-sm text-text-secondary">Tone: <span className="capitalize">{interview.persona}</span> · Mode: {interview.mode === "agent" ? "Adaptive" : "Classic"}{!isCompleted && ` · Question ${questionsInStage || 1} of up to ${interview.mode === "agent" ? 3 : 2} in this stage`}</p>
              {/* Chat area */}
              <section aria-label="Interview conversation" className="space-y-4">
                {messages.length === 0 && error && sessionId && (
                  <StatePanel
                    tone="error"
                    title="Conversation unavailable"
                    description={error}
                    action={<Button variant="ghost" onClick={async () => {
                      try { await refreshSession(sessionId); }
                      catch (err) { setError(err instanceof Error ? err.message : "Could not load the conversation"); }
                    }}>Retry conversation</Button>}
                  />
                )}
                <Conversation messages={messages} preview={interview.preview} evaluation={interview.evaluation} busy={typing} phase={interview.phase} announcement={interview.announcement} />
                {!isCompleted && !typing && (messages.length === 0 || !lastQuestion) && !error && <StatePanel tone="neutral" title="Question unavailable" description="The current question is missing. Reload the conversation to continue." action={<Button variant="ghost" onClick={() => { if (sessionId) void refreshSession(sessionId); }}>Refresh conversation</Button>} />}
                {syncPending && (!lastQuestion || isCompleted) && <Button variant="ghost" disabled={typing} onClick={() => { if (sessionId) void refreshSession(sessionId); }}>Refresh conversation</Button>}
                {typing && <Button variant="ghost" onClick={interview.cancel}>Cancel</Button>}


                {transcript && (
                  <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 text-sm">
                    <p className="mb-1 text-xs font-semibold text-text-secondary">Last transcript</p>
                    <p className="leading-relaxed">{transcript}</p>
                  </div>
                )}

                {voiceEval && <VoiceEvalCard evaluation={voiceEval} onClose={() => setVoiceEval(null)} />}

                {!isCompleted && messages.length > 0 && (
                  <div className="space-y-3 border-t border-border pt-4">
                    <label htmlFor="interview-answer" className="block text-sm font-semibold">Your answer</label>
                    <textarea
                      id="interview-answer"
                      rows={5}
                      placeholder="Explain your reasoning and answer..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      disabled={typing || syncPending || interview.retryAnswer !== null}
                      className="w-full resize-y rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-6 text-text-primary focus:border-primary focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                    <Button onClick={submitAnswer} loading={typing} loadingLabel="Processing answer" disabled={(!answer.trim() && !syncPending) || recording || transcribing || hintBusy || !lastQuestion}>{syncPending ? "Refresh conversation" : interview.retryAnswer !== null ? "Retry answer" : "Send answer"}</Button>
                    <Button variant={recording ? "danger" : "ghost"} onClick={toggleRecording} disabled={typing || transcribing || evaluatingVoice || syncPending || interview.retryAnswer !== null}>
                      {recording ? "Stop recording" : "Record voice"}
                    </Button>
                    {lastQuestion && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (!speech.lastAudio || !lastQuestion) return;
                          setEvaluatingVoice(true);
                          setVoiceEvaluationError(null);
                          try {
                            const res = await api.evaluateExplanation(speech.lastAudio.base64, lastQuestion.content, speech.lastAudio.mimeType);
                            setVoiceEval(res.evaluation);
                            toast.success("Voice evaluation complete");
                          } catch (err) {
                            setVoiceEvaluationError(speechError(err));
                          } finally {
                            setEvaluatingVoice(false);
                          }
                        }}
                        disabled={!speech.lastAudio || speech.pendingTranscript !== null || voiceEvaluationError?.retryable === false || evaluatingVoice || typing || recording || transcribing}
                        loading={evaluatingVoice}
                        loadingLabel="Evaluating voice"
                      >
                        {voiceEvaluationError?.retryable ? "Retry voice evaluation" : "Evaluate voice"}
                      </Button>
                    )}
                    </div>
                    {lastQuestion && <Hints key={lastQuestion.id} sessionId={sessionId} question={lastQuestion} hints={currentHints} draft={answer} disabled={typing || syncPending || interview.retryAnswer !== null || recording || transcribing} onHint={(message) => interview.setMessages((previous) => [...previous, message])} onReload={() => refreshSession(sessionId)} onBusy={setHintBusy} />}
                    <VoiceRecordingFeedback speech={speech} disabled={typing || evaluatingVoice || syncPending || interview.retryAnswer !== null} />
                    {voiceEvaluationError && <div className="space-y-2">
                      <p className="text-sm text-error" role="alert">{voiceEvaluationError.message}</p>
                      {!voiceEvaluationError.retryable && <Button variant="ghost" disabled={typing || evaluatingVoice || recording || transcribing} onClick={() => { setVoiceEvaluationError(null); void toggleRecording(); }}>Record again</Button>}
                    </div>}
                    {transcribing && <p className="text-sm text-text-secondary" role="status">Transcribing recording...</p>}
                    {syncPending && <p className="text-sm text-warning" role="status">The send outcome is being checked. Refresh the conversation to continue; this answer will not be sent twice.</p>}
                  </div>
                )}

                {isCompleted && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 p-6 text-center">
                      <p className="mb-2 text-xl font-bold text-accent">Interview Complete</p>
                      <p className="mb-4 text-sm text-text-secondary">
                        You finished all four stages. Review the conversation above to see feedback from each round.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {!report && !loadingReport && (
                          <Button onClick={async () => {
                            if (!sessionId) return;
                            setLoadingReport(true);
                            setReportError(null);
                            try {
                              const r = await api.getInterviewReport(sessionId);
                              setReport(r);
                            } catch (err) {
                              const message = err instanceof Error ? err.message : "Failed to generate report";
                              setReportError(message);
                              toast.error(message);
                            } finally {
                              setLoadingReport(false);
                            }
                          }}>
                            Generate report
                          </Button>
                        )}
                        {loadingReport && (
                          <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            Generating report...
                          </div>
                        )}
                        <Button variant="ghost" onClick={() => {
                          interview.reset();
                          setHintBusy(false);
                          setTranscript("");
                          speech.reset();
                          setVoiceEvaluationError(null);
                          setError(null);
                          setReport(null);
                          setReportError(null);
                          setAnswer("");
                          setVoiceEval(null);
                        }}>
                          Start New Interview
                        </Button>
                      </div>
                    </div>
                    {report && (
                      <InterviewReportCard
                        report={report}
                        messages={messages}
                        companyLabel={COMPANIES.find((c) => c.value === selectedCompany)?.label ?? selectedCompany}
                      />
                    )}
                    {reportError && <StatePanel tone="error" title="Report unavailable" description={reportError} />}
                  </div>
                )}

                {error && (messages.length > 0 || interview.preview) && <p className="text-sm text-error" role="alert">{error}</p>}
              </section>
            </div>
          )}
        </div>
      </PageShell>
    </Protected>
  );
}
