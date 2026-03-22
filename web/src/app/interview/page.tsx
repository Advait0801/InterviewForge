"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "sonner";
import { api, InterviewMessage } from "@/lib/api";

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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: "easeOut" as const },
  }),
};

type Company = "amazon" | "google" | "meta";
type Difficulty = "easy" | "medium" | "hard";

const COMPANIES: { value: Company; label: string; focus: string; color: string; icon: string }[] = [
  { value: "amazon", label: "Amazon", focus: "Leadership principles, system design, and behavioral depth.", color: "border-warning hover:border-warning/70 hover:shadow-warning/10", icon: "🛒" },
  { value: "google", label: "Google", focus: "Algorithms, problem solving, and analytical thinking.", color: "border-secondary hover:border-secondary/70 hover:shadow-secondary/10", icon: "🔍" },
  { value: "meta", label: "Meta", focus: "Practical coding, system scalability, and move-fast culture.", color: "border-primary hover:border-primary/70 hover:shadow-primary/10", icon: "🌐" },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

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
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [lastAudioBase64, setLastAudioBase64] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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
    setError(null);
    setStarting(true);
    try {
      const started = await api.startInterview(selectedCompany, selectedDifficulty);
      setSessionId(started.session.id);
      setCurrentStage(started.session.currentStage);
      const detail = await api.getInterview(started.session.id);
      setMessages(detail.messages);
      setCurrentStage(detail.session.current_stage);
      setSessionStatus(detail.session.status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start interview";
      toast.error(msg);
      setError(msg);
    } finally {
      setStarting(false);
    }
  };

  const submitAnswer = async () => {
    if (!sessionId || !answer.trim()) return;
    setTyping(true);
    setError(null);
    try {
      await api.answerInterview(sessionId, answer);
      const detail = await api.getInterview(sessionId);
      setMessages(detail.messages);
      setCurrentStage(detail.session.current_stage);
      setSessionStatus(detail.session.status);
      setAnswer("");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send answer";
      toast.error(msg);
      setError(msg);
    } finally {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const buffer = await blob.arrayBuffer();
          const base64Audio = arrayBufferToBase64(buffer);
          setLastAudioBase64(base64Audio);
          const transcribed = await api.transcribeSpeech(base64Audio);
          setTranscript(transcribed.transcript);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Transcription failed";
          toast.error(msg);
          setError(msg);
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
        <motion.div initial="hidden" animate="visible">
          {!sessionId ? (
            /* ── Pre-session setup ── */
            <div className="space-y-8">
              <motion.div variants={fadeUp} custom={0}>
                <h1 className="mb-2 text-3xl font-bold sm:text-4xl lg:text-5xl tracking-tight">Live Interview Mode</h1>
                <p className="max-w-2xl text-text-secondary text-lg leading-relaxed">
                  Simulate a full multi-stage technical interview. Choose a company and difficulty, then work through
                  behavioral, coding, system design, and core CS rounds — just like the real thing.
                </p>
              </motion.div>

              {/* Company selector */}
              <motion.div variants={fadeUp} custom={1}>
                <h2 className="mb-3 text-lg font-semibold">Select Company</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {COMPANIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setSelectedCompany(c.value)}
                      className={`rounded-2xl border-2 p-5 text-left transition-all duration-300 hover:shadow-lg ${c.color} ${
                        selectedCompany === c.value
                          ? "bg-surface shadow-lg scale-[1.02]"
                          : "border-border bg-surface/60 hover:scale-[1.01]"
                      }`}
                    >
                      <span className="text-2xl">{c.icon}</span>
                      <p className="mt-2 mb-1 text-lg font-bold">{c.label}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{c.focus}</p>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Difficulty selector */}
              <motion.div variants={fadeUp} custom={2}>
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
                        onClick={() => setSelectedDifficulty(d.value)}
                        className={`rounded-full border px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
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
              </motion.div>

              {/* Stages overview */}
              <motion.div variants={fadeUp} custom={3}>
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
              </motion.div>

              {/* Start button */}
              <motion.div variants={fadeUp} custom={4} className="flex items-center gap-4">
                <Button onClick={startSession} disabled={starting}>
                  {starting ? "Starting..." : "Start Interview"}
                </Button>
                {error && <p className="text-sm text-error">{error}</p>}
              </motion.div>

              {/* Tips */}
              <motion.div variants={fadeUp} custom={5}>
                <Card className="border-dashed">
                  <h3 className="mb-3 font-semibold text-text-secondary">Tips</h3>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-primary">▸</span>Think aloud — interviewers value your reasoning process.</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-primary">▸</span>Use the voice recorder to practice explaining solutions verbally.</li>
                    <li className="flex items-start gap-2"><span className="mt-0.5 text-primary">▸</span>Each stage has 1-2 questions with follow-ups before advancing.</li>
                  </ul>
                </Card>
              </motion.div>
            </div>
          ) : (
            /* ── Active interview session ── */
            <motion.div variants={fadeUp} custom={0} className="space-y-5">
              {/* Stage progress bar */}
              <div className="rounded-2xl border border-border bg-surface/80 backdrop-blur-sm p-5">
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
                  <div className="flex items-center gap-2">
                    <StatusPill label={typing ? "AI typing..." : isCompleted ? "Done" : "Ready"} tone={isCompleted ? "success" : "secondary"} />
                    <StatusPill label={recording ? "Listening..." : "Mic idle"} tone="warning" />
                  </div>
                </div>
                {/* Stage stepper */}
                <div className="flex gap-2">
                  {STAGES.map((s, i) => {
                    const done = i < stageIdx || isCompleted;
                    const active = i === stageIdx && !isCompleted;
                    return (
                      <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="flex w-full items-center gap-1">
                          <div
                            className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                              done ? "bg-accent" : active ? "bg-gradient-to-r from-primary to-secondary" : "bg-border"
                            }`}
                          />
                        </div>
                        <span className={`text-[10px] font-semibold ${
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
              <Card className="space-y-4 p-5">
                <div className="max-h-[calc(100vh-380px)] min-h-[320px] space-y-3 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">
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
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className={`rounded-xl border p-4 text-sm ${
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
                        </motion.div>
                      </div>
                    );
                  })}
                  {typing && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      AI is thinking...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {transcript && (
                  <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 text-sm">
                    <p className="mb-1 text-xs font-semibold text-text-secondary">Last transcript</p>
                    <p className="leading-relaxed">{transcript}</p>
                  </div>
                )}

                {!isCompleted && (
                  <div className="flex flex-col gap-3 md:flex-row">
                    <Input
                      placeholder="Type your answer..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnswer(); } }}
                      className="flex-1"
                    />
                    <Button onClick={submitAnswer} disabled={typing}>Send</Button>
                    <Button variant={recording ? "danger" : "ghost"} onClick={toggleRecording}>
                      {recording ? "Stop Mic" : "Record"}
                    </Button>
                    {lastQuestion && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (!lastAudioBase64 || !lastQuestion) return;
                          setTyping(true);
                          try {
                            await api.evaluateExplanation(lastAudioBase64, lastQuestion.content);
                            toast.success("Voice evaluation complete");
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : "Evaluation failed";
                            toast.error(msg);
                            setError(msg);
                          } finally {
                            setTyping(false);
                          }
                        }}
                      >
                        Evaluate Voice
                      </Button>
                    )}
                  </div>
                )}

                {isCompleted && (
                  <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10 p-6 text-center">
                    <p className="mb-2 text-xl font-bold text-accent">🎉 Interview Complete</p>
                    <p className="mb-4 text-sm text-text-secondary">
                      You finished all four stages. Review the conversation above to see feedback from each round.
                    </p>
                    <Button variant="ghost" onClick={() => {
                      setSessionId(null);
                      setMessages([]);
                      setCurrentStage("behavioral");
                      setSessionStatus("active");
                      setTranscript("");
                      setLastAudioBase64("");
                      setError(null);
                    }}>
                      Start New Interview
                    </Button>
                  </div>
                )}

                {error && <p className="text-sm text-error">{error}</p>}
              </Card>
            </motion.div>
          )}
        </motion.div>
      </PageShell>
    </Protected>
  );
}
