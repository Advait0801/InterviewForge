"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError, type InterviewMessage } from "@/lib/api";
import { useNow } from "@/lib/useNow";

export function Hints({ sessionId, question, hints, draft, disabled, onHint, onReload, onBusy }: {
  sessionId: string; question: InterviewMessage; hints: InterviewMessage[]; draft: string; disabled: boolean;
  onHint: (message: InterviewMessage) => void; onReload: () => Promise<void>; onBusy: (busy: boolean) => void;
}) {
  const latest = hints.at(-1) ?? question;
  const [availableAt, setAvailableAt] = useState(() => {
    const time = Date.parse(latest.created_at);
    return Number.isFinite(time) ? time + 30_000 : null;
  });
  const [remaining, setRemaining] = useState(Math.max(0, 3 - hints.length));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; locked: boolean } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const now = useNow(1000);
  const seconds = availableAt === null ? 0 : Math.max(0, Math.ceil((availableAt - now) / 1000));
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function getHint() {
    if (loading || disabled) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true); onBusy(true); setError(null);
    try {
      const result = await api.interviewHint(sessionId, draft, controller.signal);
      if (controller.signal.aborted) return;
      setRemaining(result.hintsRemaining);
      setAvailableAt(result.nextAvailableAt ? Date.parse(result.nextAvailableAt) : null);
      onHint({ id: `hint-${question.id}-${result.level}`, session_id: sessionId, role: "assistant", stage: result.stage,
        content: result.hint, created_at: new Date().toISOString(), metadata_json: { kind: "hint", level: result.level, penalty: result.penalty } });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError({ message: err instanceof Error ? err.message : "Could not get a hint. Try again.", locked: err instanceof ApiError && err.code === "hint_locked" });
      if (err instanceof ApiError && err.status === 409) {
        if (err.code === "hint_locked" && err.availableAt) setAvailableAt(Date.parse(err.availableAt));
        else if (err.code === "hints_exhausted") setRemaining(0);
        else if (!err.code) await onReload();
      }
    } finally {
      if (!controller.signal.aborted) { setLoading(false); onBusy(false); }
    }
  }
  return <div className="space-y-2">
    <Button variant="ghost" onClick={getHint} disabled={disabled || remaining === 0 || seconds > 0 || now === 0} loading={loading} loadingLabel="Getting hint">
      {remaining === 0 ? "No hints left" : seconds > 0 ? `Get a hint in ${seconds}s` : "Get a hint"}
    </Button>
    <p className="text-xs leading-relaxed text-text-secondary">Hints unlock after 30 seconds, then 30 seconds after each hint. Max 3 per question. Each hint costs 1 point off your answer’s score. {remaining} remaining.</p>
    {error && (!error.locked || seconds > 0) && <p role="alert" className="text-sm text-error">{error.message}</p>}
  </div>;
}
