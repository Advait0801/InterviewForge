"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "sonner";
import { api, InterviewMessage, InterviewReport, VoiceEvaluation } from "@/lib/api";
import { downloadInterviewPdf } from "@/lib/interviewPdf";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

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
  const [starting, setStarting] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string>("behavioral");
  const [sessionStatus, setSessionStatus] = useState<string>("active");
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [answer, setAnswer] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [evaluatingVoice, setEvaluatingVoice] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [lastAudioBase64, setLastAudioBase64] = useState<string>("");
  const [voiceEval, setVoiceEval] = useState<VoiceEvaluation | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const acceptedAnswerRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const lastQuestion = useMemo(
    () =>
      [...messages]
        .reverse()
        .find(
          (m) =>
            m.role === "assistant" &&
            (m.metadata_json?.kind === "question" || m.metadata_json?.kind === "followup"),
        ),
    [messages],
  );

  const startSession = async () => {
    setStartError(null);
    setStarting(true);
    let createdId: string | null = null;
    try {
      const started = await api.startInterview(selectedCompany, selectedDifficulty);
      createdId = started.session.id;
      setSessionId(createdId);
      setCurrentStage(started.session.currentStage);
      const detail = await api.getInterview(started.session.id);
      setMessages(detail.messages);
      setCurrentStage(detail.session.current_stage);
      setSessionStatus(detail.session.status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start interview";
      toast.error(msg);
      if (createdId) setError(msg);
      else setStartError(msg);
    } finally {
      setStarting(false);
    }
  };

  const refreshSession = async (id: string, acceptedAnswer: string | null = null) => {
    const detail = await api.getInterview(id);
    if (acceptedAnswer !== null) {
      const questionPosition = detail.messages.findIndex((message) => message.id === lastQuestion?.id);
      const answerConfirmed = questionPosition >= 0 && detail.messages.some((message, index) =>
        index > questionPosition && message.role === "candidate" && message.content === acceptedAnswer);
      if (!answerConfirmed) {
        throw new Error("This answer has not appeared in the transcript yet. Refresh again before continuing; it will not be sent twice.");
      }
    }
    setMessages(detail.messages);
    setCurrentStage(detail.session.current_stage);
    setSessionStatus(detail.session.status);
    if (acceptedAnswer !== null && acceptedAnswerRef.current === acceptedAnswer) {
      acceptedAnswerRef.current = null;
      setAnswer((previous) => previous === acceptedAnswer ? "" : previous);
    }
    setSyncPending(false);
    setError(null);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: reduceMotion ? "instant" : "smooth" }), 100);
  };

  const submitAnswer = async () => {
    if (!sessionId || !answer.trim() || sendInFlightRef.current) return;
    if (acceptedAnswerRef.current) {
      setTyping(true);
      try {
        await refreshSession(sessionId, acceptedAnswerRef.current);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not refresh this interview");
      } finally {
        setTyping(false);
      }
      return;
    }
    const submittedAnswer = answer;
    sendInFlightRef.current = true;
    setTyping(true);
    setError(null);
    try {
      await api.answerInterview(sessionId, submittedAnswer);
      acceptedAnswerRef.current = submittedAnswer;
      setSyncPending(true);
      await refreshSession(sessionId, submittedAnswer);
    } catch (err) {
      if (!acceptedAnswerRef.current) {
        acceptedAnswerRef.current = submittedAnswer;
        setSyncPending(true);
        try {
          await refreshSession(sessionId, submittedAnswer);
          return;
        } catch {
          // The server may still complete this request. Reconcile before any retry.
        }
      }
      const msg = err instanceof Error ? err.message : "Could not confirm this answer. Refresh the conversation before continuing.";
      toast.error(msg);
      setError(msg);
    } finally {
      sendInFlightRef.current = false;
      setTyping(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Microphone recording is unavailable in this browser. You can still type your answer.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const buffer = await blob.arrayBuffer();
          const base64Audio = arrayBufferToBase64(buffer);
          setLastAudioBase64(base64Audio);
          const transcribed = await api.transcribeSpeech(base64Audio);
          setTranscript(transcribed.transcript);
          setAnswer((previous) => previous ? `${previous}\n\n${transcribed.transcript}` : transcribed.transcript);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Transcription failed";
          toast.error(msg);
          setError(msg);
        } finally {
          setTranscribing(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not access microphone";
      toast.error(msg);
      setError(msg);
    }
  };

  const stageIdx = stageIndex(currentStage);
  const isCompleted = sessionStatus === "completed";

  return (
    <Protected>
      <PageShell>
        <div>
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
                  Start interview
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
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-primary">▸</span>Each stage has 1-2 questions with follow-ups before advancing.</li>
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
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">
                      {isCompleted
                        ? "Interview Complete"
                        : `Stage ${stageIdx + 1}/${STAGES.length}: ${STAGES[stageIdx]?.label ?? currentStage}`}
                    </h2>
                    <StatusPill
                      label={selectedCompany.charAt(0).toUpperCase() + selectedCompany.slice(1)}
                      tone="secondary"
                    />
                  </div>
                  <div className="flex items-center gap-2" role="status">
                    <StatusPill label={typing ? "Processing answer" : isCompleted ? "Done" : "Ready"} tone={isCompleted ? "success" : "secondary"} />
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
                <div ref={chatScrollRef} className="max-h-[min(65vh,680px)] min-h-[300px] space-y-3 overflow-y-auto border-y border-border py-4" aria-live="polite" aria-relevant="additions">
                  {messages.map((m, idx) => {
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showStageTransition = prevMsg && prevMsg.stage !== m.stage && m.role === "assistant";

                    return (
                      <div key={m.id}>
                        {showStageTransition && (
                          <div className="my-4 flex items-center gap-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                              {STAGES.find((s) => s.key === m.stage)?.label ?? m.stage}
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                          </div>
                        )}
                        <div
                          className={`max-w-3xl rounded-lg border p-4 text-sm ${
                            m.role === "assistant"
                              ? "border-primary/30 bg-primary/5"
                              : m.role === "candidate"
                                ? "border-border bg-surface/60"
                                : "border-secondary/30 bg-secondary/5"
                          }`}
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <p className="text-xs font-semibold uppercase text-text-secondary">{m.role}</p>
                            {m.role === "assistant" && m.metadata_json?.kind != null && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
                                {String(m.metadata_json.kind as string)}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  {typing && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary" role="status">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Processing your answer...
                    </div>
                  )}
                </div>

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
                      disabled={typing || syncPending}
                      className="w-full resize-y rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-6 text-text-primary focus:border-primary focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                    <Button onClick={submitAnswer} loading={typing} loadingLabel="Processing answer" disabled={!answer.trim() || recording || transcribing}>{syncPending ? "Refresh conversation" : "Send answer"}</Button>
                    <Button variant={recording ? "danger" : "ghost"} onClick={toggleRecording} disabled={typing || transcribing}>
                      {recording ? "Stop recording" : "Record voice"}
                    </Button>
                    {lastQuestion && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (!lastAudioBase64 || !lastQuestion) return;
                          setEvaluatingVoice(true);
                          try {
                            const res = await api.evaluateExplanation(lastAudioBase64, lastQuestion.content);
                            setVoiceEval(res.evaluation);
                            toast.success("Voice evaluation complete");
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : "Evaluation failed";
                            toast.error(msg);
                            setError(msg);
                          } finally {
                            setEvaluatingVoice(false);
                          }
                        }}
                        disabled={!lastAudioBase64 || evaluatingVoice || typing}
                        loading={evaluatingVoice}
                        loadingLabel="Evaluating voice"
                      >
                        Evaluate voice
                      </Button>
                    )}
                    </div>
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
                      <div className="flex items-center justify-center gap-3">
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
                          setSessionId(null);
                          setMessages([]);
                          setCurrentStage("behavioral");
                          setSessionStatus("active");
                          setTranscript("");
                          setLastAudioBase64("");
                          setError(null);
                          setReport(null);
                          setReportError(null);
                          setSyncPending(false);
                          acceptedAnswerRef.current = null;
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

                {error && messages.length > 0 && <p className="text-sm text-error" role="alert">{error}</p>}
              </section>
            </div>
          )}
        </div>
      </PageShell>
    </Protected>
  );
}

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

function VoiceEvalCard({ evaluation, onClose }: { evaluation: VoiceEvaluation; onClose: () => void }) {
  const overallColor = evaluation.overallScore >= 7 ? "text-accent" : evaluation.overallScore >= 4 ? "text-warning" : "text-error";
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Voice Evaluation</h3>
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

function InterviewReportCard({
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
        <h3 className="text-lg font-bold">Interview Report</h3>
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
          <h4 className="text-sm font-semibold text-text-secondary">Stage Scores</h4>
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
          <h4 className="mb-1.5 text-sm font-semibold text-accent">Strengths</h4>
          <ul className="space-y-1 text-sm text-text-secondary">
            {report.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-accent">+</span>{s}</li>)}
          </ul>
        </div>
      )}

      {report.weaknesses?.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold text-error">Areas for Improvement</h4>
          <ul className="space-y-1 text-sm text-text-secondary">
            {report.weaknesses.map((w, i) => <li key={i} className="flex gap-2"><span className="text-error">-</span>{w}</li>)}
          </ul>
        </div>
      )}

      {report.recommendations?.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold text-secondary">Recommendations</h4>
          <ul className="space-y-1 text-sm text-text-secondary">
            {report.recommendations.map((r, i) => <li key={i} className="flex gap-2"><span className="text-secondary">*</span>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
