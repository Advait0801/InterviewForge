import { transferableAbortController } from "node:util";
import { vi } from "vitest";
import { peerSession } from "./group-d-fixtures";

type Handler = (...args: unknown[]) => void;
export class MockSocket {
  connected = false;
  auth: unknown;
  handlers = new Map<string, Handler>();
  joinAck: unknown = {
    ok: true,
    session: peerSession,
    presence: { interviewer: true, candidate: false },
  };
  endAck: unknown = {
    ok: true,
    session: {
      ...peerSession,
      status: "completed",
      endedReason: "ended_by_participant",
    },
  };
  ackError: Error | null = null;
  on = vi.fn((event: string, handler: Handler) => {
    this.handlers.set(event, handler);
    return this;
  });
  emit = vi.fn((_event: string, ..._args: unknown[]) => {
    void _event;
    void _args;
    return this;
  });
  timeout = vi.fn(() => ({
    emit: (event: string, ...args: unknown[]) => {
      this.emit(event, ...args);
      const ack = args.at(-1) as Handler;
      if (event === "join") ack(this.ackError, this.joinAck);
      if (event === "end") ack(this.ackError, this.endAck);
    },
  }));
  connect = vi.fn(() => {
    this.connected = true;
    this.fire("connect");
    return this;
  });
  disconnect = vi.fn(() => {
    this.connected = false;
    return this;
  });
  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.(...args);
  }
}
export class MockTrack {
  id = Math.random().toString();
  enabled = true;
  readyState = "live";
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
  constructor(public kind: "audio" | "video") {}
}
export class MockStream {
  constructor(private tracks: MockTrack[] = []) {}
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
  addTrack(track: MockTrack) {
    this.tracks.push(track);
  }
}
export class MockPeer {
  static instances: MockPeer[] = [];
  signalingState = "stable";
  connectionState = "new";
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  onicecandidate:
    | ((event: { candidate: { toJSON: () => RTCIceCandidateInit } }) => void)
    | null = null;
  onnegotiationneeded: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack:
    ((event: { track: MockTrack; streams: MockStream[] }) => void) | null =
    null;
  setConfiguration = vi.fn();
  addTrack = vi.fn(() => {
    queueMicrotask(() => this.onnegotiationneeded?.());
  });
  addIceCandidate = vi.fn(async () => {});
  createDataChannel = vi.fn(() => {
    queueMicrotask(() => this.onnegotiationneeded?.());
  });
  setRemoteDescription = vi.fn(
    async (description: RTCSessionDescriptionInit) => {
      this.remoteDescription = description;
      this.signalingState =
        description.type === "offer" ? "have-remote-offer" : "stable";
    },
  );
  setLocalDescription = vi.fn(async () => {
    const type =
      this.signalingState === "have-remote-offer" ? "answer" : "offer";
    this.localDescription = { type, sdp: `${type}-sdp` };
    this.signalingState = type === "offer" ? "have-local-offer" : "stable";
  });
  close = vi.fn(() => {
    this.connectionState = "closed";
  });
  constructor(public config: RTCConfiguration) {
    MockPeer.instances.push(this);
  }
}
export function installPeerMocks() {
  vi.stubGlobal(
    "AbortController",
    class {
      constructor() {
        return transferableAbortController();
      }
    },
  );
  MockPeer.instances = [];
  vi.stubGlobal("RTCPeerConnection", MockPeer);
  vi.stubGlobal("MediaStream", MockStream);
  const getUserMedia = vi.fn(
    async (options: MediaStreamConstraints) =>
      new MockStream([new MockTrack(options.audio ? "audio" : "video")]),
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  return getUserMedia;
}
