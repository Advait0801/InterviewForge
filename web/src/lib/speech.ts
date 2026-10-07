/** Recorder payload kept locally for a retry of usable audio. */
export type RecordedAudio = { base64: string; mimeType: string };
export type SpeechError = { message: string; retryable: boolean };

export const MICROPHONE_UNAVAILABLE = "Microphone recording is unavailable in this browser. You can still type your answer.";
export const MICROPHONE_INSECURE = "Microphone access requires a secure connection. Open this page over HTTPS or localhost, or type your answer instead.";

export function microphoneError(error: unknown): string {
  const name = typeof error === "object" && error !== null && "name" in error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
      return "Microphone access is blocked. Allow it from your browser's site settings, or type your answer instead.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Connect one, or type your answer instead.";
    case "NotReadableError":
      return "The microphone is in use by another app. Close that app and try again, or type your answer instead.";
    case "SecurityError":
      return MICROPHONE_INSECURE;
    default:
      return "Could not access the microphone. Check your browser's site settings and microphone connection, or type your answer instead.";
  }
}

export function recordingMimeType(): string | undefined {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
}

/** Only an explicit retryable response offers a retry of the same recording. */
export function speechError(error: unknown): SpeechError {
  return {
    message: error instanceof Error ? error.message : "The recording could not be processed. Record again, or type your answer instead.",
    retryable: typeof error === "object" && error !== null && "retryable" in error && error.retryable === true,
  };
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
