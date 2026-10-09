"""
Labelled cases for the interviewer-upgrade evaluation (D-066).

Contexts are frozen excerpts of real corpus chunks (as retrieval returned them on
2026-10-07), so a recorded run stays meaningful if the corpus later grows. Each challenge
case is labelled by hand: `contradicts=True` only when the answer states something the
context directly says is false. The `False` half deliberately includes the hard
negatives -- an answer that agrees, one about something the context doesn't cover, and a
weak-but-not-wrong answer -- because pushing back on any of those is the failure that
would make the feature worse than not having it.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

GOOGLE_CS = (
    "Google Core CS: Distributed Systems Theory for Interviews\n\n"
    "Beyond APIs, expect questions on theoretical underpinnings.\n\n"
    "Consensus: roles of leaders and followers; why Raft is easier to reason about than Paxos in "
    "practice for many systems.\n"
    "Clocks: logical clocks vs vector clocks for ordering events.\n"
    "Idempotency: why at-least-once delivery plus idempotent handlers gives effective exactly-once behavior.\n"
    "Backpressure: signaling producers to slow when consumers lag.\n\n---\n\n"
    "Google Core CS: Networking Deep Dives\n\n"
    "Beyond TCP vs UDP:\n"
    "- QUIC over UDP: connection migration, reduced head-of-line blocking.\n"
    "- TLS 1.3 handshake vs 1.2; forward secrecy.\n"
    "- DNS: caching layers, TTL, EDNS client subnet.\n"
    "- Anycast vs unicast for global routing."
)
APPLE_CS = (
    "Apple Core CS: Memory, Concurrency, and Real-Time Constraints\n\n"
    "Expect fundamentals tied to client and systems quality.\n\n"
    "Memory: stack vs heap, alignment, cache lines and false sharing.\n"
    "Concurrency: actors vs locks; deadlock avoidance; priority inversion on embedded-style systems.\n"
    "Scheduling: QoS classes; when work should move off the main thread.\n"
    "Real-time audio/video: bounded queues, backpressure, drop policies.\n\n"
    "Link answers to user-visible symptoms: jank, frame drops, audio glitches."
)
META_SD = (
    "Meta System Design: Real-Time and Presence\n\n"
    "Designs often include presence (online/offline), typing indicators, or live counts.\n\n"
    "Approaches:\n"
    "- WebSockets or long polling for client updates.\n"
    "- Ephemeral state in memory with gossip or a dedicated presence service.\n"
    "- Rate limiting fan-out for popular rooms.\n"
    "- Merging updates to reduce client churn.\n\n"
    "Consistency: last-write-wins vs CRDTs for certain counters.\n\n---\n\n"
    "We're introducing ZGateway, the proxy we are using to unify traffic through ZippyDB, Meta's most "
    "widely-used key value store.\n"
    "As a bonus, it also enables admission control, load balancing, cross-region resilience, and richer operations."
)
AMAZON_SD = (
    "Amazon System Design: Peak Events and Cost\n\n"
    "Prime Day-style traffic requires planning beyond steady-state QPS.\n\n"
    "Topics:\n"
    "- Pre-warming capacity and autoscaling policies.\n"
    "- Feature flags to shed non-critical work under load.\n"
    "- Multi-AZ and failover drills.\n"
    "- Cost per request: caching, batching, choice of instance family.\n"
    "- Vendor and multi-region failover for critical dependencies."
)


@dataclass(frozen=True)
class ChallengeCase:
    id: str
    company: str
    stage: str
    question: str
    context: str
    answer: str
    contradicts: bool


CHALLENGE_CASES: List[ChallengeCase] = [
    ChallengeCase(
        "consensus-wrong", "google", "core_cs", "How would you choose a consensus protocol?", GOOGLE_CS,
        "Paxos is much easier to reason about than Raft in practice, which is why most new systems pick Paxos. "
        "I'd use Multi-Paxos with a stable leader.",
        True,
    ),
    ChallengeCase(
        "consensus-right", "google", "core_cs", "How would you choose a consensus protocol?", GOOGLE_CS,
        "I'd pick Raft. It separates leader election from log replication, so it's easier to reason about than "
        "Paxos and there are solid implementations like etcd's.",
        False,
    ),
    ChallengeCase(
        "quic-wrong", "google", "core_cs", "Why might a client prefer QUIC?", GOOGLE_CS,
        "QUIC runs on top of TCP, so it inherits TCP's head-of-line blocking; the benefit is only the faster TLS handshake.",
        True,
    ),
    ChallengeCase(
        "not-covered", "google", "core_cs", "How would you design the internal APIs between services?", GOOGLE_CS,
        "I'd use gRPC with protobuf schemas, set a deadline on every call, and propagate it downstream so a slow "
        "dependency can't hold resources forever.",
        False,
    ),
    ChallengeCase(
        "exactly-once-wrong", "google", "core_cs", "How do you get exactly-once processing from a queue?", GOOGLE_CS,
        "You can't. At-least-once delivery can never give you exactly-once behaviour, even if every handler is idempotent, "
        "so you need distributed transactions.",
        True,
    ),
    ChallengeCase(
        "exactly-once-right", "google", "core_cs", "How do you get exactly-once processing from a queue?", GOOGLE_CS,
        "Accept at-least-once delivery and make the handlers idempotent with a dedupe key stored alongside the write; "
        "that gives you effectively exactly-once processing without distributed transactions.",
        False,
    ),
    ChallengeCase(
        "audio-wrong", "apple", "core_cs", "How would you keep real-time audio glitch-free under load?", APPLE_CS,
        "Use unbounded queues between the decoder and the audio thread so nothing is ever dropped, and let the queue "
        "grow until the load passes.",
        True,
    ),
    ChallengeCase(
        "audio-right", "apple", "core_cs", "How would you keep real-time audio glitch-free under load?", APPLE_CS,
        "Keep the audio work off the main thread with a high QoS class, use a bounded queue, and drop the oldest "
        "buffers when the consumer lags so latency stays low.",
        False,
    ),
    ChallengeCase(
        "zippydb-wrong", "meta", "system_design", "Where would you store per-user counters?", META_SD,
        "ZippyDB is a niche store at Meta that hardly anything uses, so I'd put the counters in MySQL with a cache in front.",
        True,
    ),
    ChallengeCase(
        "zippydb-right", "meta", "system_design", "Where would you store per-user counters?", META_SD,
        "A key-value store like ZippyDB, behind a proxy that does admission control and load balancing, with "
        "last-write-wins for counters that can tolerate it.",
        False,
    ),
    ChallengeCase(
        "presence-wrong", "meta", "system_design", "How would you build online presence?", META_SD,
        "Presence can't be done with WebSockets or long polling at Meta's scale, so clients poll a REST endpoint once a minute.",
        True,
    ),
    ChallengeCase(
        "presence-weak", "meta", "system_design", "How would you build online presence?", META_SD,
        "Presence is hard. I'd probably store it in some database and update it now and then.",
        False,
    ),
    ChallengeCase(
        "prewarm-wrong", "amazon", "system_design", "How would you prepare a service for Prime Day?", AMAZON_SD,
        "There's no need to pre-warm capacity before Prime Day; reactive autoscaling alone handles the spike, and "
        "multi-AZ failover drills are a waste of time.",
        True,
    ),
    ChallengeCase(
        "prewarm-right", "amazon", "system_design", "How would you prepare a service for Prime Day?", AMAZON_SD,
        "Pre-warm capacity days ahead, tune the autoscaling policies, and put recommendations behind a feature flag "
        "so we can shed them if load spikes.",
        False,
    ),
    # Added after the first run, before the verifier was measured: more "a different valid
    # choice than the one the context lists" negatives, the kind the first run got wrong.
    ChallengeCase(
        "clocks-different", "google", "core_cs", "How would you order events across replicas?", GOOGLE_CS,
        "I'd use vector clocks rather than plain logical clocks, because I need to detect concurrent updates, "
        "not just get some total order.",
        False,
    ),
    ChallengeCase(
        "locks-different", "apple", "core_cs", "How would you protect shared state on the audio path?", APPLE_CS,
        "I'd keep locks but use ones with priority inheritance, so a low-priority holder gets boosted instead of "
        "blocking the audio thread.",
        False,
    ),
    ChallengeCase(
        "shedding-different", "amazon", "system_design", "How would you prepare a service for Prime Day?", AMAZON_SD,
        "Instead of feature flags I'd shed load at the load balancer with priority classes, so checkout traffic always "
        "wins over browsing.",
        False,
    ),
]

# (company, stage) pairs the persona and hint runs generate questions for.
PERSONA_PAIRS: List[Tuple[str, str]] = [
    ("amazon", "behavioral"),
    ("google", "coding"),
    ("meta", "system_design"),
    ("apple", "core_cs"),
    ("microsoft", "behavioral"),
    ("uber", "system_design"),
    ("bloomberg", "coding"),
    ("airbnb", "core_cs"),
]

# Added with the second persona prompt and never used to tune it; reported separately.
PERSONA_PAIRS_HELD_OUT: List[Tuple[str, str]] = [
    ("uber", "coding"),
    ("linkedin", "system_design"),
    ("adobe", "behavioral"),
    ("bloomberg", "core_cs"),
]


@dataclass(frozen=True)
class HintCase:
    id: str
    company: str
    stage: str
    question: str
    context: str


HINT_CASES: List[HintCase] = [
    HintCase("two-sum", "google", "coding",
             "Given an array of integers and a target, return the indices of two numbers that add up to the target. "
             "Can you do better than O(n^2)?", ""),
    HintCase("lru", "meta", "coding", "Design an LRU cache with O(1) get and put.", ""),
    HintCase("rate-limiter", "amazon", "system_design",
             "Design a rate limiter for a public API that must handle bursts.", AMAZON_SD),
    HintCase("exactly-once", "google", "core_cs",
             "A payment queue delivers messages at least once. How do you avoid charging a customer twice?", GOOGLE_CS),
    HintCase("presence", "meta", "system_design", "Design online/offline presence for a chat app with 1B users.", META_SD),
    HintCase("priority-inversion", "apple", "core_cs",
             "A high-priority audio thread keeps missing deadlines waiting on a lock. What is happening and how do you fix it?",
             APPLE_CS),
    # Held out: added with the second rung definitions, never used to tune them.
    HintCase("cycle", "microsoft", "coding",
             "Detect whether a singly linked list has a cycle using O(1) extra space.", ""),
    HintCase("resharding", "uber", "system_design",
             "A cache cluster grows from 10 to 12 nodes. How do you avoid remapping almost every key?", ""),
]
