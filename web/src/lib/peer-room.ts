import { io, type Socket } from "socket.io-client";
import { api, type Language, type PeerSession } from "./api";
import { clearToken, getToken } from "./auth";
import { getSocketOrigin } from "./socket";
import { microphoneError } from "./speech";

export type Presence = { interviewer: boolean; candidate: boolean };
export type ConnectionStatus =
  | "waiting for your partner"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "couldn't connect";
export type EndReason = NonNullable<PeerSession["endedReason"]>;
type Signal =
  | { type: "offer" | "answer"; sdp: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit };
type JoinAck =
  | { ok: true; session: PeerSession; presence: Presence }
  | {
      ok: false;
      code: "invalid" | "not_found" | "ended" | "unavailable";
      error: string;
    };
type Observer = {
  session: (session: PeerSession) => void;
  presence: (presence: Presence) => void;
  status: (status: ConnectionStatus) => void;
  notice: (message: string | null) => void;
  error: (message: string | null) => void;
  ended: (reason: EndReason) => void;
  code: (code: string, language: string) => void;
  streams: (local: MediaStream | null, remote: MediaStream | null) => void;
  login: () => void;
};

/** One lifecycle per room: shared code survives even if a network cannot carry media. */
export class PeerRoomConnection {
  private socket: Socket | null = null;
  private pc: RTCPeerConnection | null = null;
  private peerPending: Promise<RTCPeerConnection> | null = null;
  private local: MediaStream | null = null;
  private remote: MediaStream | null = null;
  private ice: Awaited<ReturnType<typeof api.getPeerIceServers>> | null = null;
  private iceTimer: ReturnType<typeof setTimeout> | null = null;
  private codeTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCode: { code: string; language: Language } | null = null;
  private candidates: RTCIceCandidateInit[] = [];
  private makingOffer = false;
  private settingAnswer = false;
  private ignoreOffer = false;
  private joined = false;
  private disposed = false;
  private finished = false;
  private rateNoticed = false;
  private partnerPresent = false;
  private connectedOnce = false;
  private authToken: string | null = null;
  private signalQueue = Promise.resolve();
  private abort = new AbortController();
  private polite: boolean;

  constructor(
    private session: PeerSession,
    private observer: Observer,
  ) {
    this.polite = session.myRole === "candidate";
  }
  start() {
    if (this.session.status !== "waiting" && this.session.status !== "active")
      return;
    this.authToken = getToken();
    if (!this.authToken) {
      this.observer.login();
      return;
    }
    const socket = (this.socket = io(getSocketOrigin() + "/peer", {
      auth: { token: this.authToken },
      autoConnect: false,
    }));
    socket.on("connect", () => {
      if (this.disposed || this.finished) return;
      this.observer.error(null);
      this.observer.status(this.connectedOnce ? "reconnecting" : "connecting");
      this.connectedOnce = true;
      socket
        .timeout(10000)
        .emit(
          "join",
          { sessionId: this.session.id },
          (timeout: Error | null, ack?: JoinAck) => {
            if (this.disposed || this.finished) return;
            if (timeout || !ack) {
              this.observer.error(
                "Joining the room timed out. Retry the connection.",
              );
              this.observer.status("couldn't connect");
              return;
            }
            if (!ack.ok) {
              const messages = {
                invalid: "The room request is invalid.",
                not_found: "This room doesn't exist or isn't available to you.",
                ended: "This session has ended. Reload to view feedback.",
                unavailable: "The room is temporarily unavailable.",
              };
              this.observer.error(`${messages[ack.code]} ${ack.error}`);
              this.observer.status("couldn't connect");
              if (ack.code === "ended")
                void api
                  .getPeerSession(this.session.id, this.abort.signal)
                  .then(({ session }) => {
                    if (this.disposed || this.finished) return;
                    if (
                      session.status === "completed" ||
                      session.status === "cancelled"
                    ) {
                      this.session = session;
                      this.observer.session(session);
                      this.observer.error(null);
                      this.finish(
                        session.endedReason ?? "ended_by_participant",
                      );
                    }
                  })
                  .catch(() => {});
              return;
            }
            this.joined = true;
            this.session = ack.session;
            this.observer.session(ack.session);
            if (this.pendingCode) this.flushCode();
            else this.observer.code(ack.session.code, ack.session.language);
            this.presence(ack.presence);
            if (
              ack.session.status === "completed" ||
              ack.session.status === "cancelled"
            )
              this.finish(ack.session.endedReason ?? "ended_by_participant");
          },
        );
    });
    socket.on("presence", (presence: Presence) => this.presence(presence));
    socket.on("started", (clock: { startedAt: string; endsAt: string }) => {
      if (this.finished || this.disposed) return;
      this.session = { ...this.session, ...clock, status: "active" };
      this.observer.session(this.session);
    });
    socket.on("signal", ({ data }: { from: string; data: Signal }) => {
      this.signalQueue = this.signalQueue
        .then(() => this.receiveSignal(data))
        .catch((e) => {
          if (!this.disposed && !this.finished) this.fail(e);
        });
    });
    socket.on(
      "code",
      ({
        code,
        language,
      }: {
        from: string;
        code: string;
        language: string;
      }) => {
        if (this.disposed || this.finished) return;
        // A remote write wins over a local edit still waiting in the debounce queue.
        if (this.codeTimer) clearTimeout(this.codeTimer);
        this.pendingCode = null;
        this.observer.code(code, language);
      },
    );
    socket.on(
      "peer_error",
      ({
        code,
        error,
      }: {
        code: "invalid" | "rate_limited" | "not_joined";
        error: string;
      }) => {
        if (this.disposed || this.finished) return;
        if (code === "rate_limited" && this.rateNoticed) return;
        if (code === "rate_limited") this.rateNoticed = true;
        this.observer.notice(error);
      },
    );
    socket.on("ended", ({ reason }: { reason: EndReason }) =>
      this.finish(reason),
    );
    socket.on("connect_error", (e: Error & { data?: { code?: string } }) => {
      if (this.disposed || this.finished) return;
      if (e.data?.code === "session_invalid") {
        const current = getToken();
        if (current && current !== this.authToken) this.refreshAuth(current);
        else {
          socket.disconnect();
          clearToken();
          this.observer.login();
        }
      } else {
        this.observer.status("couldn't connect");
        this.observer.error("Could not reach the room. Retry the connection.");
      }
    });
    socket.on("disconnect", (reason: string) => {
      this.joined = false;
      if (this.codeTimer) clearTimeout(this.codeTimer);
      this.codeTimer = null;
      if (this.disposed || this.finished) return;
      this.observer.status("reconnecting");
      if (reason === "io server disconnect") {
        const current = getToken();
        if (current && current !== this.authToken) this.refreshAuth(current);
        else {
          clearToken();
          this.observer.login();
        }
      }
    });
    socket.connect();
  }
  private refreshAuth(token: string) {
    this.authToken = token;
    if (this.socket) {
      this.socket.auth = { token };
      this.socket.connect();
    }
  }
  private presence(value: Presence) {
    if (this.disposed || this.finished) return;
    this.observer.presence(value);
    const wasPresent = this.partnerPresent;
    this.partnerPresent = this.polite ? value.interviewer : value.candidate;
    if (!this.partnerPresent) {
      this.clearConnectionTimer();
      this.observer.status("waiting for your partner");
      return;
    }
    if (!this.joined) return;
    if (!wasPresent && !this.session.partner) {
      void api
        .getPeerSession(this.session.id, this.abort.signal)
        .then(({ session }) => {
          if (this.disposed || this.finished) return;
          this.session = {
            ...session,
            startedAt: session.startedAt ?? this.session.startedAt,
            endsAt: session.endsAt ?? this.session.endsAt,
            status:
              session.status === "waiting" && this.session.status === "active"
                ? "active"
                : session.status,
          };
          this.observer.session(this.session);
        })
        .catch(() => {
          if (!this.disposed && !this.finished)
            this.observer.notice(
              "Could not refresh your partner's details. Reconnect to try again.",
            );
        });
    }
    this.observer.status(
      this.pc?.connectionState === "connected" ? "connected" : "connecting",
    );
    this.armConnectionTimer();
    void this.ensurePeer()
      .then(async (pc) => {
        if (this.disposed || this.finished) return;
        if (!this.polite && pc.signalingState === "stable") {
          // A data channel establishes a connection even with both media devices off.
          if (!this.pcHasChannel) {
            pc.createDataChannel("peer-presence");
            this.pcHasChannel = true;
          } else if (!wasPresent && pc.connectionState !== "connected")
            await this.offer();
        }
      })
      .catch((e) => this.fail(e));
  }
  private pcHasChannel = false;
  private clearConnectionTimer() {
    if (this.connectionTimer) clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }
  private armConnectionTimer() {
    if (this.pc?.connectionState === "connected") return;
    this.clearConnectionTimer();
    this.connectionTimer = setTimeout(() => {
      if (!this.disposed && !this.finished)
        this.observer.status("couldn't connect");
    }, 20000);
  }
  private fail(e: unknown) {
    if (this.disposed || this.finished) return;
    this.observer.status("couldn't connect");
    this.observer.error(
      e instanceof Error ? e.message : "The peer connection failed.",
    );
  }
  private async refreshIce() {
    if (
      !this.ice ||
      (this.ice.expiresAt && Date.parse(this.ice.expiresAt) <= Date.now())
    ) {
      const ice = await api.getPeerIceServers(this.abort.signal);
      if (this.disposed || this.finished) return;
      this.ice = ice;
      this.pc?.setConfiguration({ iceServers: ice.iceServers });
      if (this.iceTimer) clearTimeout(this.iceTimer);
      if (ice.expiresAt) {
        this.iceTimer = setTimeout(
          () => {
            this.ice = null;
            void this.refreshIce().catch((e) => this.fail(e));
          },
          Math.max(1000, Date.parse(ice.expiresAt) - Date.now()),
        );
      }
    }
  }
  private async ensurePeer(): Promise<RTCPeerConnection> {
    if (this.peerPending) return this.peerPending;
    if (this.pc) {
      await this.refreshIce();
      return this.pc;
    }
    this.peerPending = (async () => {
      await this.refreshIce();
      if (this.disposed || this.finished)
        throw new Error("The room has closed.");
      const pc = (this.pc = new RTCPeerConnection({
        iceServers: this.ice?.iceServers ?? [],
      }));
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && this.joined && !this.disposed && !this.finished)
          this.socket?.emit("signal", {
            type: "candidate",
            candidate: candidate.toJSON(),
          });
      };
      pc.onnegotiationneeded = () => {
        if (this.joined && this.partnerPresent)
          void this.offer().catch((e) => this.fail(e));
      };
      pc.ontrack = ({ track, streams }) => {
        if (this.disposed || this.finished) return;
        this.remote ??= new MediaStream();
        const incoming = streams[0]?.getTracks() ?? [track];
        for (const t of incoming)
          if (!this.remote.getTracks().some((existing) => existing.id === t.id))
            this.remote.addTrack(t);
        this.observer.streams(this.local, this.remote);
      };
      pc.onconnectionstatechange = () => {
        if (this.disposed || this.finished) return;
        if (pc.connectionState === "connected") {
          this.clearConnectionTimer();
          this.observer.status("connected");
        } else if (pc.connectionState === "failed") {
          this.clearConnectionTimer();
          this.observer.status("couldn't connect");
        } else if (pc.connectionState === "disconnected") {
          this.observer.status("reconnecting");
          this.armConnectionTimer();
        } else if (this.partnerPresent) this.observer.status("connecting");
      };
      for (const track of this.local?.getTracks() ?? [])
        pc.addTrack(track, this.local!);
      return pc;
    })();
    try {
      return await this.peerPending;
    } finally {
      this.peerPending = null;
    }
  }
  private async offer() {
    if (
      !this.joined ||
      !this.partnerPresent ||
      this.makingOffer ||
      this.finished ||
      this.disposed
    )
      return;
    const pc = await this.ensurePeer();
    if (
      this.makingOffer ||
      pc.signalingState !== "stable" ||
      this.disposed ||
      this.finished
    )
      return;
    try {
      this.makingOffer = true;
      await pc.setLocalDescription();
      if (pc.localDescription && !this.disposed && !this.finished)
        this.socket?.emit("signal", {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp,
        });
    } finally {
      this.makingOffer = false;
    }
  }
  private async receiveSignal(data: Signal) {
    if (this.disposed || this.finished || !this.joined) return;
    const pc = await this.ensurePeer();
    if (data.type === "candidate") {
      if (this.ignoreOffer) return;
      if (!pc.remoteDescription) this.candidates.push(data.candidate);
      else await pc.addIceCandidate(data.candidate);
      return;
    }
    const ready =
      !this.makingOffer &&
      (pc.signalingState === "stable" || this.settingAnswer);
    const collision = data.type === "offer" && !ready;
    this.ignoreOffer = !this.polite && collision;
    if (this.ignoreOffer) {
      this.candidates = [];
      return;
    }
    try {
      this.settingAnswer = data.type === "answer";
      // setRemoteDescription rolls back a colliding local offer for the polite peer.
      await pc.setRemoteDescription({ type: data.type, sdp: data.sdp });
    } finally {
      this.settingAnswer = false;
    }
    for (const candidate of this.candidates.splice(0))
      await pc.addIceCandidate(candidate);
    if (data.type === "offer") {
      await pc.setLocalDescription();
      if (pc.localDescription && !this.disposed && !this.finished)
        this.socket?.emit("signal", {
          type: "answer",
          sdp: pc.localDescription.sdp,
        });
    }
  }
  sendCode(code: string, language: Language) {
    if (this.disposed || this.finished) return;
    if (code.length > 50000) {
      this.observer.notice("Shared code is limited to 50,000 characters.");
      return;
    }
    this.pendingCode = { code, language };
    if (this.codeTimer) clearTimeout(this.codeTimer);
    if (this.joined) this.codeTimer = setTimeout(() => this.flushCode(), 300);
  }
  private flushCode() {
    if (this.pendingCode && this.joined && !this.finished)
      this.socket?.emit("code", this.pendingCode);
    this.pendingCode = null;
    if (this.codeTimer) clearTimeout(this.codeTimer);
    this.codeTimer = null;
  }
  async enableMedia(kind: "audio" | "video") {
    if (this.disposed || this.finished) return;
    const existing = this.local
      ?.getTracks()
      .find((t) => t.kind === kind && t.readyState !== "ended");
    if (existing) {
      existing.enabled = true;
      this.observer.streams(this.local, this.remote);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        `${kind === "audio" ? "Microphone" : "Camera"} access is unavailable in this browser. You can still share code.`,
      );
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: kind === "audio",
        video: kind === "video",
      });
    } catch (e) {
      throw new Error(
        microphoneError(e)
          .replace(/Microphone/g, kind === "audio" ? "Microphone" : "Camera")
          .replace(/microphone/g, kind === "audio" ? "microphone" : "camera")
          .replace(/type your answer instead/g, "keep sharing code"),
      );
    }
    if (this.disposed || this.finished) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.local ??= new MediaStream();
    const pc = await this.ensurePeer().catch((e) => {
      stream.getTracks().forEach((t) => t.stop());
      throw e;
    });
    if (this.disposed || this.finished) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    for (const track of stream.getTracks()) {
      this.local.addTrack(track);
      pc.addTrack(track, this.local);
    }
    this.observer.streams(this.local, this.remote);
  }
  toggleMedia(kind: "audio" | "video") {
    for (const track of this.local
      ?.getTracks()
      .filter((t) => t.kind === kind) ?? [])
      track.enabled = !track.enabled;
    this.observer.streams(this.local, this.remote);
  }
  async end() {
    if (!this.socket?.connected || !this.joined)
      throw new Error("Reconnect to the room before ending the session.");
    this.flushCode();
    await new Promise<void>((resolve, reject) => {
      this.socket!.timeout(10000).emit(
        "end",
        (
          timeout: Error | null,
          ack?: { ok: boolean; session?: PeerSession; error?: string },
        ) => {
          if (timeout || !ack?.ok) {
            reject(
              new Error(ack?.error ?? "Ending the session failed. Try again."),
            );
            return;
          }
          if (ack.session) {
            this.session = ack.session;
            this.observer.session(ack.session);
            this.finish(ack.session.endedReason ?? "ended_by_participant");
          }
          resolve();
        },
      );
    });
  }
  private stopMedia() {
    this.local?.getTracks().forEach((t) => t.stop());
    this.remote?.getTracks().forEach((t) => t.stop());
    this.local = null;
    this.remote = null;
    this.pc?.close();
    this.pc = null;
    this.observer.streams(null, null);
    if (this.iceTimer) clearTimeout(this.iceTimer);
    this.clearConnectionTimer();
  }
  private finish(reason: EndReason) {
    if (this.finished || this.disposed) return;
    this.finished = true;
    this.stopMedia();
    if (this.codeTimer) clearTimeout(this.codeTimer);
    this.abort.abort();
    this.socket?.disconnect();
    this.observer.ended(reason);
  }
  dispose() {
    if (this.disposed) return;
    this.flushCode();
    this.disposed = true;
    this.abort.abort();
    this.socket?.emit("leave");
    this.socket?.disconnect();
    this.stopMedia();
    if (this.codeTimer) clearTimeout(this.codeTimer);
  }
}
