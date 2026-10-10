"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type InterviewMessage, type InterviewMode, type Persona, type StartInterviewOptions, type StartStreamEvent, type AnswerStreamEvent, type Evaluation, type AgentNote, type Challenge } from "@/lib/api";

export type QuestionPreview = { text: string; stage: string; kind: "question" | "followup"; agent?: AgentNote; challenge?: Challenge };
const messageOf = (err: unknown) => err instanceof Error ? err.message : "Could not load this interview. Please try again.";

export function useInterview() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState("behavioral");
  const [sessionStatus, setSessionStatus] = useState("active");
  const [persona, setPersona] = useState<Persona>("neutral");
  const [mode, setMode] = useState<InterviewMode>("fixed");
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("Thinking…");
  const [preview, setPreview] = useState<QuestionPreview | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [retryAnswer, setRetryAnswer] = useState<string | null>(null);
  const actionRef = useRef<AbortController | null>(null);
  const acceptedAnswerRef = useRef<string | null>(null);
  const authoritativeRef = useRef<QuestionPreview | null>(null);
  const lastQuestion = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant" &&
    (m.metadata_json.kind === "question" || m.metadata_json.kind === "followup")), [messages]);

  useEffect(() => {
    const abort = () => actionRef.current?.abort();
    const onPageHide = () => {
      abort();
      setBusy(false);
      setPreview(authoritativeRef.current);
      setEvaluation(null);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => { abort(); window.removeEventListener("pagehide", onPageHide); };
  }, []);

  function begin() {
    actionRef.current?.abort();
    const controller = new AbortController();
    actionRef.current = controller;
    setBusy(true);
    return controller;
  }
  function finish(controller: AbortController) {
    if (actionRef.current === controller && !controller.signal.aborted) setBusy(false);
  }
  function onEvent(event: StartStreamEvent | AnswerStreamEvent) {
    if (event.type === "question") {
      setPreview({ text: "", kind: event.kind, stage: event.stage });
      setPhase("Thinking of the next question…");
    } else if (event.type === "delta") {
      setPreview((previous) => previous && { ...previous, text: previous.text + event.text });
    } else if (event.type === "evaluation") {
      setEvaluation(event.evaluation);
      setPhase("Thinking of the next question…");
    }
  }
  function confirmQuestion(question: QuestionPreview | null) {
    authoritativeRef.current = question;
    setPreview(question);
    setAnnouncement(question?.text ?? "Interview complete.");
  }

  async function refreshSession(id: string, acceptedAnswer: string | null = acceptedAnswerRef.current, controller = begin()) {
    setSyncPending(true);
    try {
      const detail = await api.getInterview(id, controller.signal);
      if (controller.signal.aborted) return;
      if (acceptedAnswer !== null) {
        const position = detail.messages.findIndex((m) => m.id === lastQuestion?.id);
        if (position < 0 || !detail.messages.some((m, i) => i > position && m.role === "candidate" && m.content === acceptedAnswer)) {
          throw new Error("This answer has not appeared in the transcript yet. Refresh again before continuing; it will not be sent twice.");
        }
      }
      const finalQuestion = authoritativeRef.current;
      const latest = [...detail.messages].reverse().find((m) => m.metadata_json.kind === "question" || m.metadata_json.kind === "followup");
      setMessages(detail.messages.map((m) => m.id === latest?.id && finalQuestion && m.stage === finalQuestion.stage ? { ...m, content: finalQuestion.text } : m));
      setCurrentStage(detail.session.current_stage);
      setSessionStatus(detail.session.status);
      setPersona(detail.session.persona);
      setMode(detail.session.mode);
      if (acceptedAnswer !== null) setAnswer((previous) => previous === acceptedAnswer ? "" : previous);
      acceptedAnswerRef.current = null;
      authoritativeRef.current = null;
      setPreview(null);
      setEvaluation(null);
      setRetryAnswer(null);
      setSyncPending(false);
      setError(null);
    } catch (err) {
      if (!controller.signal.aborted) setError(messageOf(err));
    } finally { finish(controller); }
  }

  async function startSession(options: StartInterviewOptions) {
    const controller = begin();
    const requestOptions = options;
    setStartError(null);
    setPreview(null);
    setEvaluation(null);
    setPhase("Thinking of the opening question…");
    try {
      const started = await api.startInterviewStream(requestOptions, (event) => { if (!controller.signal.aborted) onEvent(event); }, controller.signal);
      if (controller.signal.aborted) return;
      setSessionId(started.session.id);
      setCurrentStage(started.session.currentStage);
      setSessionStatus(started.session.status);
      setPersona(started.session.persona);
      setMode(started.session.mode);
      confirmQuestion({ text: started.openingQuestion.question, kind: "question", stage: started.session.currentStage });
      setPhase("Loading conversation…");
      await refreshSession(started.session.id, null, controller);
    } catch (err) {
      if (controller.signal.aborted) return;
      setPreview(null);
      setStartError(messageOf(err));
    } finally { finish(controller); }
  }

  async function submitAnswer() {
    if (!sessionId || busy) return;
    if (syncPending) { await refreshSession(sessionId); return; }
    const submitted = retryAnswer ?? answer;
    if (!submitted.trim()) return;
    const controller = begin();
    setError(null);
    setRetryAnswer(null);
    setPreview(null);
    setEvaluation(null);
    setPhase("Evaluating your answer…");
    try {
      const result = await api.answerInterviewStream(sessionId, submitted, (event) => { if (!controller.signal.aborted) onEvent(event); }, controller.signal);
      if (controller.signal.aborted) return;
      acceptedAnswerRef.current = submitted;
      setSyncPending(true);
      setEvaluation(result.evaluation);
      if (result.action === "completed") {
        setSessionStatus("completed");
        confirmQuestion(null);
      } else {
        const stage = result.action === "advance_stage" ? result.currentStage : result.stage;
        setCurrentStage(stage);
        confirmQuestion({ text: result.nextQuestion.question, stage, kind: result.action === "followup" ? "followup" : "question",
          agent: result.agent, challenge: result.action === "followup" ? result.nextQuestion.challenge : undefined });
      }
      setPhase("Loading conversation…");
      await refreshSession(sessionId, submitted, controller);
    } catch (err) {
      if (controller.signal.aborted) return;
      setPreview(null);
      setEvaluation(null);
      setError(messageOf(err));
      if (err instanceof ApiError && err.retryable === true) setRetryAnswer(submitted);
      else if (err instanceof ApiError && (err.retryable === false || [400, 401, 404, 409, 429].includes(err.status))) {
        if (err.retryable === false || err.status === 409) {
          await refreshSession(sessionId, null, controller);
          if (!controller.signal.aborted) setError(messageOf(err));
        }
      } else {
        // Transport loss has no terminal event: reconcile before issuing another POST.
        acceptedAnswerRef.current = submitted;
        await refreshSession(sessionId, submitted, controller);
      }
    } finally { finish(controller); }
  }

  function reset() {
    actionRef.current?.abort();
    setBusy(false);
    setSessionId(null);
    setCurrentStage("behavioral");
    setSessionStatus("active");
    setMessages([]);
    setAnswer("");
    setError(null);
    setStartError(null);
    setSyncPending(false);
    setPreview(null);
    setEvaluation(null);
    setAnnouncement("");
    setRetryAnswer(null);
    acceptedAnswerRef.current = null;
    authoritativeRef.current = null;
  }
  function cancel() {
    actionRef.current?.abort();
    setBusy(false);
    setPreview(authoritativeRef.current);
    setEvaluation(null);
  }
  return { sessionId, currentStage, sessionStatus, persona, mode, messages, setMessages, answer, setAnswer, busy,
    phase, preview, evaluation, announcement, error, setError, startError, syncPending, retryAnswer, lastQuestion,
    startSession, submitAnswer, refreshSession, reset, cancel };
}
