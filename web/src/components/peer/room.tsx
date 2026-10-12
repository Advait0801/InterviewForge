"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { api, type PeerSession } from "@/lib/api";
import {
  PeerRoomConnection,
  type ConnectionStatus,
  type EndReason,
  type Presence,
} from "@/lib/peer-room";
import { useNow } from "@/lib/useNow";
import { asLanguage, LanguagePicker } from "@/components/language-picker";
import { PeerFeedback } from "./feedback";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";

const Editor = dynamic(
  () =>
    import("@/components/code-workspace-editor").then(
      (m) => m.CodeWorkspaceEditor,
    ),
  { ssr: false, loading: () => <LoadingState label="Loading shared editor" /> },
);
const reasons: Record<EndReason, string> = {
  ended_by_participant: "A participant ended the interview.",
  time_up: "The interview time is up.",
  cancelled: "The interview was cancelled.",
  expired: "The unused invite expired.",
};

function Media({
  stream,
  local,
  audioOnly = false,
}: {
  stream: MediaStream | null;
  local?: boolean;
  audioOnly?: boolean;
}) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [playError, setPlayError] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    let active = true;
    if (stream)
      void element.play().catch(() => {
        if (active) setPlayError(true);
      });
    return () => {
      active = false;
      element.srcObject = null;
    };
  }, [stream]);
  return (
    <div className="min-w-0 space-y-2">
      {audioOnly ? (
        <audio ref={ref} autoPlay aria-label="Partner audio" />
      ) : (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          aria-label={
            local
              ? "Your camera preview (muted)"
              : "Partner video; sound plays through partner audio"
          }
          className="aspect-video w-full rounded-xl bg-background object-contain"
        />
      )}
      {playError && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void ref.current
              ?.play()
              .then(() => setPlayError(false))
              .catch(() => setPlayError(true));
          }}
        >
          Play {audioOnly ? "partner audio" : "video"}
        </Button>
      )}
    </div>
  );
}

export function PeerRoom({ initialSession }: { initialSession: PeerSession }) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [status, setStatus] = useState<ConnectionStatus>(
    "waiting for your partner",
  );
  const [presence, setPresence] = useState<Presence>({
    interviewer: false,
    candidate: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ended, setEnded] = useState<EndReason | null>(
    initialSession.endedReason,
  );
  const [code, setCode] = useState(initialSession.code);
  const [language, setLanguage] = useState(asLanguage(initialSession.language));
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [mediaBusy, setMediaBusy] = useState<"audio" | "video" | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [retry, setRetry] = useState(0);
  const connection = useRef<PeerRoomConnection | null>(null);
  const now = useNow(1000);
  const closed =
    Boolean(ended) ||
    session.status === "completed" ||
    session.status === "cancelled";
  const remaining =
    session.endsAt && now
      ? Math.max(0, Math.ceil((Date.parse(session.endsAt) - now) / 1000))
      : null;
  const refresh = useCallback(async () => {
    try {
      const result = await api.getPeerSession(initialSession.id);
      setSession(result.session);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not refresh the session.",
      );
    }
  }, [initialSession.id]);
  useEffect(() => {
    const engine = new PeerRoomConnection(initialSession, {
      session: setSession,
      presence: setPresence,
      status: setStatus,
      notice: setNotice,
      error: setError,
      code: (value, lang) => {
        setCode(value);
        setLanguage(asLanguage(lang));
      },
      streams: (self, other) => {
        setLocal(self);
        setRemote(other ? new MediaStream(other.getTracks()) : null);
        setMic(Boolean(self?.getAudioTracks().some((t) => t.enabled)));
        setCamera(Boolean(self?.getVideoTracks().some((t) => t.enabled)));
      },
      ended: (reason) => {
        setEnded(reason);
        setSession((s) => ({
          ...s,
          status:
            reason === "cancelled" || reason === "expired"
              ? "cancelled"
              : "completed",
          endedReason: reason,
        }));
        void refresh();
      },
      login: () => router.replace("/login?expired=1"),
    });
    connection.current = engine;
    engine.start();
    return () => {
      connection.current = null;
      engine.dispose();
    };
  }, [initialSession, retry, router, refresh]);
  async function media(kind: "audio" | "video") {
    setMediaBusy(kind);
    setMediaError(null);
    try {
      await connection.current?.enableMedia(kind);
    } catch (e) {
      setMediaError(
        e instanceof Error
          ? e.message
          : "Could not enable media. You can still share code.",
      );
    } finally {
      setMediaBusy(null);
    }
  }
  async function end() {
    if (!window.confirm("End this interview for both participants?")) return;
    setEnding(true);
    setError(null);
    try {
      await connection.current?.end();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not end the interview. Try again.",
      );
    } finally {
      setEnding(false);
    }
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Peer interview room</h1>
          <p className="mt-2 break-words text-text-secondary">
            You are the {session.myRole}.{" "}
            {session.partner
              ? `Partner: ${session.partner.username}`
              : "Your partner has not joined yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              connection.current?.dispose();
              router.push("/peer");
            }}
          >
            Leave room
          </Button>
          {!closed && (
            <Button onClick={end} loading={ending} loadingLabel="Ending…">
              End session
            </Button>
          )}
        </div>
      </header>
      {session.problem && (
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/problems/${session.problem.id}`}
              className="break-words font-semibold text-primary underline"
            >
              {session.problem.title}
            </Link>
            <Badge>{session.problem.difficulty}</Badge>
          </div>
        </Card>
      )}
      {error && (
        <StatePanel
          tone="error"
          title="Room request failed"
          description={error}
          action={
            <Button onClick={closed ? refresh : () => setRetry((r) => r + 1)}>
              {closed ? "Refresh session" : "Retry connection"}
            </Button>
          }
        />
      )}
      {closed ? (
        <>
          <StatePanel
            title="Interview ended"
            description={
              reasons[ended ?? session.endedReason ?? "ended_by_participant"]
            }
          />
          <PeerFeedback session={session} onSaved={setSession} />
          <Button variant="secondary" onClick={refresh}>
            Refresh partner feedback
          </Button>
        </>
      ) : (
        <>
          <Card className="space-y-3">
            <p role="status" className="font-semibold capitalize">
              {status}
            </p>
            {status === "couldn't connect" && (
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  Some networks block direct connections. A relay (TURN) is
                  needed to connect on those networks. You can keep sharing
                  code.
                </p>
                {!error && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRetry((r) => r + 1)}
                  >
                    Retry connection
                  </Button>
                )}
              </div>
            )}
            <p className="text-sm text-text-secondary">
              Interviewer: {presence.interviewer ? "in the room" : "away"} ·
              Candidate: {presence.candidate ? "in the room" : "away"}
            </p>
            <p className="text-sm text-text-secondary">
              {remaining === null
                ? "The clock starts when both participants are in the room."
                : remaining > 0
                  ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} remaining`
                  : "Waiting for the server to confirm the end of the interview…"}
            </p>
          </Card>
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">
              Audio and video (optional)
            </h2>
            <p className="text-sm text-text-secondary">
              You can practise with code and presence alone. Your devices turn
              on only when you choose.
            </p>
            <div className="flex flex-wrap gap-2">
              {local?.getAudioTracks().length ? (
                <Button
                  variant="secondary"
                  onClick={() => connection.current?.toggleMedia("audio")}
                >
                  {mic ? "Mute microphone" : "Unmute microphone"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={Boolean(mediaBusy)}
                  onClick={() => media("audio")}
                >
                  Turn on microphone
                </Button>
              )}
              {local?.getVideoTracks().length ? (
                <Button
                  variant="secondary"
                  onClick={() => connection.current?.toggleMedia("video")}
                >
                  {camera ? "Turn off camera" : "Turn on camera"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={Boolean(mediaBusy)}
                  onClick={() => media("video")}
                >
                  Turn on camera
                </Button>
              )}
            </div>
            {mediaBusy && (
              <p role="status" className="text-sm text-text-secondary">
                Waiting for {mediaBusy === "audio" ? "microphone" : "camera"}{" "}
                access…
              </p>
            )}
            {mediaError && (
              <p role="alert" className="text-sm text-error">
                {mediaError}
              </p>
            )}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium">Your camera</h3>
                {camera ? (
                  <Media stream={local} local />
                ) : (
                  <p className="text-sm text-text-secondary">Camera off</p>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Partner&apos;s video
                </h3>
                {remote?.getVideoTracks().length ? (
                  <Media stream={remote} />
                ) : (
                  <p className="text-sm text-text-secondary">
                    No partner video yet
                  </p>
                )}
              </div>
            </div>
            <Media stream={remote} audioOnly />
          </Card>
          {notice && (
            <p
              role="status"
              className="break-words text-sm text-text-secondary"
            >
              {notice}
            </p>
          )}
        </>
      )}
      <Card className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Shared code</h2>
          <LanguagePicker
            value={language}
            disabled={closed}
            onChange={(lang) => {
              setLanguage(lang);
              connection.current?.sendCode(code, lang);
            }}
          />
        </div>
        <p className="text-sm text-text-secondary">
          Changes sync automatically. The latest edit wins. Up to 50,000
          characters.
        </p>
        <Editor
          preserveCursor
          value={code}
          language={language}
          readOnly={closed}
          onChange={(value) => {
            setCode(value);
            connection.current?.sendCode(value, language);
          }}
          className="h-[420px] min-w-0 overflow-hidden rounded-xl border border-border"
        />
      </Card>
    </div>
  );
}
