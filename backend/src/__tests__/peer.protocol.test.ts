import { describe, expect, it } from "vitest";
import { MAX_CANDIDATE_CHARS, MAX_SDP_CHARS, TokenBucket, validateCode, validateSignal } from "../realtime/peer.protocol";
import { MAX_CODE_CHARS } from "../services/peer.service";

describe("validateSignal", () => {
  it("passes offers and answers, keeping only type and sdp", () => {
    expect(validateSignal({ type: "offer", sdp: "v=0", __proto__x: 1, ip: "leak" })).toEqual({ type: "offer", sdp: "v=0" });
    expect(validateSignal({ type: "answer", sdp: "v=0" })).toEqual({ type: "answer", sdp: "v=0" });
  });

  it("bounds the SDP", () => {
    expect(validateSignal({ type: "offer", sdp: "x".repeat(MAX_SDP_CHARS) })).not.toBeNull();
    expect(validateSignal({ type: "offer", sdp: "x".repeat(MAX_SDP_CHARS + 1) })).toBeNull();
    expect(validateSignal({ type: "offer", sdp: "" })).toBeNull();
    expect(validateSignal({ type: "offer", sdp: 42 })).toBeNull();
  });

  it("normalises ICE candidates and rejects malformed ones", () => {
    expect(validateSignal({ type: "candidate", candidate: { candidate: "" } })).toEqual({
      type: "candidate",
      candidate: { candidate: "", sdpMid: null, sdpMLineIndex: null, usernameFragment: null },
    });
    for (const bad of [
      { candidate: "x".repeat(MAX_CANDIDATE_CHARS + 1) },
      { candidate: "c", sdpMLineIndex: -1 },
      { candidate: "c", sdpMLineIndex: 1.5 },
      { candidate: "c", sdpMid: "x".repeat(65) },
      { candidate: 7 },
      "c",
    ]) {
      expect(validateSignal({ type: "candidate", candidate: bad }), JSON.stringify(bad).slice(0, 40)).toBeNull();
    }
  });

  it("refuses everything else", () => {
    for (const bad of [null, undefined, "offer", [], { type: "bye" }, { type: "OFFER", sdp: "v=0" }]) {
      expect(validateSignal(bad)).toBeNull();
    }
  });
});

describe("validateCode", () => {
  it("accepts the platform's languages and bounded code", () => {
    expect(validateCode({ code: "", language: "rust" })).toEqual({ code: "", language: "rust" });
    expect(validateCode({ code: "x".repeat(MAX_CODE_CHARS), language: "go" })).not.toBeNull();
    expect(validateCode({ code: "x".repeat(MAX_CODE_CHARS + 1), language: "go" })).toBeNull();
    expect(validateCode({ code: "x", language: "brainfuck" })).toBeNull();
    expect(validateCode({ code: 1, language: "go" })).toBeNull();
  });
});

describe("TokenBucket", () => {
  it("allows a burst up to capacity, then refills at its rate", () => {
    let now = 0;
    const b = new TokenBucket(3, 2, () => now);
    expect([b.take(), b.take(), b.take(), b.take()]).toEqual([true, true, true, false]);
    now = 499;
    expect(b.take()).toBe(false);
    now = 500;
    expect(b.take()).toBe(true);
    now = 100_000;
    expect([b.take(), b.take(), b.take(), b.take()]).toEqual([true, true, true, false]);
  });
});
