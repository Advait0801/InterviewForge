"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
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
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function InterviewPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [answer, setAnswer] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [lastAudioBase64, setLastAudioBase64] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    try {
      const started = await api.startInterview("google", "medium");
      setSessionId(started.session.id);
      const detail = await api.getInterview(started.session.id);
      setMessages(detail.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start interview");
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
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send answer");
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
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const buffer = await blob.arrayBuffer();
        const base64Audio = arrayBufferToBase64(buffer);
        setLastAudioBase64(base64Audio);
        const transcribed = await api.transcribeSpeech(base64Audio);
        setTranscript(transcribed.transcript);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not access microphone");
    }
  };

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" variants={fadeUp}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusPill label="Interview in Progress" tone="success" />
            <StatusPill label={typing ? "AI typing..." : "Ready"} tone="secondary" />
            <StatusPill label={recording ? "Listening..." : "Mic idle"} tone="warning" />
          </div>

          {!sessionId ? (
            <Card>
              <h1 className="mb-3 text-2xl font-semibold">Live Interview Mode</h1>
              <p className="mb-4 text-sm text-text-secondary">
                Start a new interview session to receive your first question.
              </p>
              <Button onClick={startSession}>Start Interview</Button>
            </Card>
          ) : (
            <Card className="space-y-4">
              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-3">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`rounded-xl border p-3 text-sm ${
                      m.role === "assistant"
                        ? "border-primary/50 bg-surface"
                        : m.role === "candidate"
                          ? "border-border bg-black/20"
                          : "border-secondary/40 bg-secondary/10"
                    }`}
                  >
                    <p className="mb-1 text-xs uppercase text-text-secondary">{m.role}</p>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </motion.div>
                ))}
                {typing ? <p className="text-sm text-text-secondary">AI is thinking...</p> : null}
              </div>

              {transcript ? (
                <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm">
                  <p className="mb-1 text-xs text-text-secondary">Last transcript</p>
                  <p>{transcript}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  placeholder="Type your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={submitAnswer}>Send</Button>
                <Button variant={recording ? "danger" : "ghost"} onClick={toggleRecording}>
                  {recording ? "Stop Mic" : "Record"}
                </Button>
                {lastQuestion ? (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      if (!lastAudioBase64 || !lastQuestion) return;
                      setTyping(true);
                      try {
                        await api.evaluateExplanation(lastAudioBase64, lastQuestion.content);
                      } finally {
                        setTyping(false);
                      }
                    }}
                  >
                    Evaluate Voice
                  </Button>
                ) : null}
              </div>
              {error ? <p className="text-sm text-error">{error}</p> : null}
            </Card>
          )}
        </motion.div>
      </PageShell>
    </Protected>
  );
}
