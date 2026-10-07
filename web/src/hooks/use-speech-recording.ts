"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { arrayBufferToBase64, microphoneError, MICROPHONE_INSECURE, MICROPHONE_UNAVAILABLE, recordingMimeType, speechError, type RecordedAudio, type SpeechError } from "@/lib/speech";

export function useSpeechRecording(onTranscript: (transcript: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<SpeechError | null>(null);
  const [lastAudio, setLastAudio] = useState<RecordedAudio | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const transcribe = useCallback(async (audio: RecordedAudio) => {
    setTranscribing(true);
    setError(null);
    try {
      const { transcript } = await api.transcribeSpeech(audio.base64, audio.mimeType);
      if (!mountedRef.current) return;
      const text = transcript.trim();
      if (text.split(/\s+/).filter(Boolean).length <= 1) setPendingTranscript(text);
      else onTranscriptRef.current(text);
    } catch (err) {
      if (!mountedRef.current) return;
      const failure = speechError(err);
      setError(failure);
      if (!failure.retryable) setLastAudio(null);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setTranscribing(false);
    }
  }, []);

  const toggleRecording = useCallback(async () => {
    const activeRecorder = recorderRef.current;
    if (activeRecorder?.state === "recording") {
      activeRecorder.stop();
      activeRecorder.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setPendingTranscript(null);
    setLastAudio(null);
    let stream: MediaStream | undefined;
    try {
      if (!window.isSecureContext) {
        setError({ message: MICROPHONE_INSECURE, retryable: false });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setError({ message: MICROPHONE_UNAVAILABLE, retryable: false });
        return;
      }
      const mimeType = recordingMimeType();
      if (!mimeType) {
        setError({ message: MICROPHONE_UNAVAILABLE, retryable: false });
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      const startedAt = performance.now();
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach((track) => track.stop());
        if (!mountedRef.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (blob.size < 1024 || performance.now() - startedAt < 500) {
          busyRef.current = false;
          setError({ message: "That recording was too short. Record for at least half a second, or type your answer instead.", retryable: false });
          return;
        }
        busyRef.current = true;
        setTranscribing(true);
        try {
          const audio = { base64: arrayBufferToBase64(await blob.arrayBuffer()), mimeType: recorder.mimeType };
          if (!mountedRef.current) return;
          setLastAudio(audio);
          await transcribe(audio);
        } catch {
          busyRef.current = false;
          if (mountedRef.current) {
            setTranscribing(false);
            setError({ message: "The recording could not be read. Record again, or type your answer instead.", retryable: false });
          }
        }
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
        busyRef.current = false;
        if (mountedRef.current) {
          setRecording(false);
          setError({ message: "The microphone stopped recording. Record again, or type your answer instead.", retryable: false });
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      if (mountedRef.current) setError({ message: microphoneError(err), retryable: false });
    } finally {
      if (recorderRef.current?.state !== "recording") busyRef.current = false;
    }
  }, [transcribe]);

  const retryTranscription = () => {
    if (!lastAudio || !error?.retryable || busyRef.current) return;
    busyRef.current = true;
    return transcribe(lastAudio);
  };
  const confirmTranscript = () => {
    if (pendingTranscript?.trim()) onTranscriptRef.current(pendingTranscript);
    setPendingTranscript(null);
  };
  const discardTranscript = () => { setPendingTranscript(null); setLastAudio(null); };
  const reset = () => { setError(null); setLastAudio(null); setPendingTranscript(null); };

  return { recording, transcribing, error, lastAudio, pendingTranscript, toggleRecording, retryTranscription, confirmTranscript, discardTranscript, reset };
}
