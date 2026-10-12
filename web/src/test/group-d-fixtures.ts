import type { ComplexityAnalysis, PeerSession, RatingOutcome } from "@/lib/api";
export const complexity: ComplexityAnalysis = {
  fit: {
    status: "measured",
    bestFit: "O(n)",
    candidates: ["O(n)", "O(n log n)"],
    confidence: "medium",
    slope: 1.1,
    fits: [{ class: "O(n)", error: 0.1 }],
    points: [
      { n: 256, ns: 1200 },
      { n: 512, ns: 2500 },
      { n: 1024, ns: 1200000 },
    ],
  },
  stopped: "done",
  error: null,
  errorAtN: null,
  measuredAt: "2026-10-11T20:00:00Z",
  claim: { text: "O(n)", class: "O(n)", verdict: "consistent" },
};
export const rating: RatingOutcome = {
  score: 1,
  expected: 0.85,
  before: 1500,
  after: 1506,
  delta: 6,
};
export const peerSession: PeerSession = {
  id: "peer-id",
  status: "waiting",
  myRole: "interviewer",
  isHost: true,
  partner: { username: "Grace", role: "candidate" },
  problem: { id: "p", slug: "two-sum", title: "Two Sum", difficulty: "easy" },
  durationMinutes: 45,
  createdAt: "2026-10-11T20:00:00Z",
  startedAt: null,
  endsAt: null,
  endedAt: null,
  endedReason: null,
  code: "# Shared code",
  language: "python3",
  feedback: { given: null, received: null },
};
