"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  api,
  ApiError,
  type IntegrityEvent,
  type IntegrityEventType,
} from "@/lib/api";

/** No clipboard contents are retained: only a synchronous character count is used. */
export function useProctoring(id: string | undefined, active: boolean) {
  const queue = useRef<IntegrityEvent[]>([]);
  const enabled = useRef(false);
  const closed = useRef(false);
  const pending = useRef(new Set<Promise<void>>());
  const currentId = useRef(id);
  const flush = useCallback(async (): Promise<void> => {
    // Start the request immediately, including when a previous batch is still pending.
    // A tab-hidden flush must not sit behind a slow request.
    while (currentId.current && !closed.current && queue.current.length) {
      const batch = queue.current.splice(0, 50);
      const assessmentId = currentId.current;
      const request = (async () => {
        try {
          await api.recordAssessmentEvents(assessmentId, batch);
        } catch (error) {
          if (
            currentId.current === assessmentId &&
            error instanceof ApiError &&
            error.status === 409 &&
            ["assessment_closed", "event_limit"].includes(error.code ?? "")
          ) {
            closed.current = true;
            enabled.current = false;
            queue.current = [];
          }
          // Drop rejected batches; instrumentation never blocks assessment work.
        }
      })();
      pending.current.add(request);
      void request.then(() => {
        pending.current.delete(request);
      });
    }
    await Promise.all([...pending.current]);
  }, []);
  const stop = useCallback(async () => {
    enabled.current = false;
    await flush();
  }, [flush]);

  useEffect(() => {
    if (currentId.current !== id) {
      closed.current = false;
      queue.current = [];
    }
    currentId.current = id;
    enabled.current = Boolean(id && active);
    if (!enabled.current || closed.current) return;
    const record = (type: IntegrityEventType, chars?: number) => {
      if (!enabled.current || closed.current) return;
      queue.current.push({
        type,
        at: new Date().toISOString(),
        ...(chars === undefined ? {} : { chars }),
      });
      if (queue.current.length >= 50 || type === "tab_hidden") void flush();
    };
    const visibility = () =>
      record(
        document.visibilityState === "hidden" ? "tab_hidden" : "tab_visible",
      );
    const blur = () => record("window_blur");
    const focus = () => record("window_focus");
    const fullscreen = () =>
      record(
        document.fullscreenElement ? "fullscreen_enter" : "fullscreen_exit",
      );
    const paste = (event: ClipboardEvent) =>
      record("paste", event.clipboardData?.getData("text/plain").length ?? 0);
    const copy = (event: ClipboardEvent) => {
      // Monaco supplies the model's selection length through the editor wrapper.
      if (
        event.target instanceof Element &&
        event.target.closest("[data-proctoring-editor]")
      )
        return;
      const element = document.activeElement;
      const chars =
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLInputElement
          ? Math.max(
              0,
              (element.selectionEnd ?? 0) - (element.selectionStart ?? 0),
            )
          : (window.getSelection()?.toString().length ?? 0);
      record(
        "copy",
        event.clipboardData?.getData("text/plain").length || chars,
      );
    };
    const editorCopy = (event: Event) => {
      const chars: unknown = (event as CustomEvent<{ chars: number }>).detail
        ?.chars;
      if (typeof chars === "number" && Number.isInteger(chars) && chars >= 0)
        record("copy", chars);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("paste", paste, true);
    document.addEventListener("copy", copy, true);
    document.addEventListener("if-editor-copy", editorCopy);
    document.addEventListener("fullscreenchange", fullscreen);
    const timer = setInterval(() => {
      void flush();
    }, 5000);
    return () => {
      enabled.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("paste", paste, true);
      document.removeEventListener("copy", copy, true);
      document.removeEventListener("if-editor-copy", editorCopy);
      document.removeEventListener("fullscreenchange", fullscreen);
      void flush();
    };
  }, [id, active, flush]);
  return { stop };
}
