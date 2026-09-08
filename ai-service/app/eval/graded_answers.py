"""
Answers at known quality tiers, for judge calibration.

The claim under test is ordinal, not absolute: we do not assert "a strong answer
scores 8". We assert the judge ranks strong > mediocre > weak for the same
question. Absolute scores drift with prompt and model changes; the ordering is
what has to hold, and if it breaks the scoring is not measuring quality.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

TIERS = ("weak", "mediocre", "strong")


@dataclass(frozen=True)
class GradedCase:
    id: str
    company: str
    stage: str
    question: str
    answers: dict  # tier -> answer text


GRADED_CASES: List[GradedCase] = [
    GradedCase(
        id="amz-beh-ownership",
        company="amazon",
        stage="behavioral",
        question="Tell me about a time you took ownership of a problem outside your remit.",
        answers={
            "weak": "I usually help out when things break. I'm a team player and I care about doing a good job.",
            "mediocre": (
                "Our checkout service started throwing errors over a weekend and it wasn't owned by my team, but "
                "nobody was looking at it, so I picked it up. I dug through the logs, traced it to a config change "
                "that had gone out on Friday, and put together a rollback. I got the owning team's on-call to review "
                "it and we shipped the fix that morning, which brought the errors back down. Afterwards I wrote up "
                "what happened so the team had a record of it. I don't remember the exact numbers, but it was "
                "affecting a noticeable share of checkouts while it lasted."
            ),
            "strong": (
                "Situation: our checkout error rate jumped from 0.1% to 4% over a weekend, owned by another team "
                "with nobody on call. Task: I was on call for the adjacent service and customers were failing to pay, "
                "so I took it. Action: I correlated the spike to a config push that lowered a connection pool limit, "
                "reproduced it in staging, wrote the rollback, got the owning team's on-call paged and approved, and "
                "shipped it. Then I wrote the postmortem and added an alert on pool saturation plus a CI check that "
                "blocks pool-size reductions without a load test. Result: error rate back to 0.1% in 40 minutes, "
                "roughly $180k of recovered orders, and the alert has caught two similar regressions since. "
                "The trade-off I weighed was rolling back immediately versus waiting for the owning team; I chose "
                "rollback because customer impact was ongoing and the change was trivially reversible."
            ),
        },
    ),
    GradedCase(
        id="goo-cod-complexity",
        company="google",
        stage="coding",
        question="How would you find the k most frequent elements in an array, and what is the complexity?",
        answers={
            "weak": "I would sort the array and then count things. Sorting is pretty fast so it should be fine.",
            "mediocre": (
                "Use a hash map to count frequencies, then sort the entries by count and take the top k. "
                "The counting is O(n) and the sort is O(n log n), so overall O(n log n) time and O(n) space."
            ),
            "strong": (
                "Count frequencies in a hash map in O(n) time and O(u) space where u is the number of unique values. "
                "Then to select the top k I'd avoid a full sort: a min-heap of size k gives O(u log k) time and O(k) "
                "extra space, which beats O(u log u) when k is much smaller than u. If I need strictly linear time, "
                "bucket sort by frequency works: frequencies are bounded by n, so I can bucket counts into an array "
                "of size n+1 and walk it downward, giving O(n) time and O(n) space. Edge cases: k larger than the "
                "number of unique elements, ties at the k-th boundary which need a defined tiebreak, and empty input. "
                "I'd pick the heap in an interview for the space win unless n is huge and k is close to u."
            ),
        },
    ),
    GradedCase(
        id="met-sd-newsfeed",
        company="meta",
        stage="system_design",
        question="Design the backend for a news feed that shows posts from people you follow.",
        answers={
            "weak": "I'd have a database with posts and users, and when you open the app it queries the posts and shows them.",
            "mediocre": (
                "Store posts in a database sharded by user id, and a follow graph. On read, fetch the people you follow "
                "and query their recent posts, merge them by timestamp, and cache the result in Redis so repeat loads "
                "are fast. Add a CDN for media."
            ),
            "strong": (
                "The core decision is fan-out on write versus on read. Fan-out on write pushes each post into follower "
                "inboxes so reads are a single sequential scan, which is right for the median user; but for accounts "
                "with millions of followers the write amplification is fatal. So: hybrid. Normal accounts fan out on "
                "write into a per-user inbox in a partitioned store; celebrity accounts are excluded and merged at read "
                "time from their own timelines. Sizing: assume 100M DAU, ~2 feed loads each, so ~2-3k feed reads/sec "
                "average with peaks several times that. Inboxes are capped at a few hundred entries since nobody "
                "scrolls further, which bounds storage. Consistency: the feed is eventually consistent and that's "
                "acceptable — a post appearing a few seconds late is invisible to users — but the author's own view "
                "must be read-your-writes, so I'd route the author's reads through their timeline directly. "
                "Failure modes: if the fan-out queue backs up, feeds go stale rather than erroring, which is the right "
                "degradation. Ranking sits on top as a separate scoring service so retrieval and ranking scale "
                "independently."
            ),
        },
    ),
]
