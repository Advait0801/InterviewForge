"use client";

import { Button } from "@/components/ui/button";
import type { useSpeechRecording } from "@/hooks/use-speech-recording";

export function VoiceRecordingFeedback({ speech, disabled = false }: { speech: ReturnType<typeof useSpeechRecording>; disabled?: boolean }) {
  return <>
    {speech.error && <div className="mt-2 space-y-2">
      <p role="alert" className="text-sm text-error">{speech.error.message}</p>
      <Button variant="ghost" disabled={disabled || speech.transcribing || speech.recording} onClick={speech.error.retryable ? speech.retryTranscription : speech.toggleRecording}>
        {speech.error.retryable ? "Retry transcription" : "Record again"}
      </Button>
    </div>}
    {speech.pendingTranscript !== null && <div className="mt-2 space-y-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
      <p role="status" className="text-sm">We heard {speech.pendingTranscript ? `“${speech.pendingTranscript}”` : "no words"}. Confirm this short transcript before adding it to your answer.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" disabled={disabled || !speech.pendingTranscript.trim()} onClick={speech.confirmTranscript}>Use transcript</Button>
        <Button variant="ghost" disabled={disabled} onClick={speech.discardTranscript}>Discard transcript</Button>
      </div>
    </div>}
  </>;
}
