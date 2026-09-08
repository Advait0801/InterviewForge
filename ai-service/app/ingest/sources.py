"""
The source allowlist.

Sources are tiered by how freely their content can be ingested. Only TIER 1 and
TIER 2 domains are ever fetched; TIER 3 exists to record, explicitly, what we
deliberately do *not* ingest and why, so nobody adds it later by accident.

TIER 1 -- publicly published engineering writing and openly licensed material.
         Fetched and ingested with attribution.
TIER 2 -- free public articles on individual/company sites. Same treatment, but
         these are more likely to move or disappear, so provenance matters more.
TIER 3 -- NOT INGESTED. Paid, proprietary, or ToS-restricted content. These are
         used only as a *taxonomy* reference (which topics matter, in what
         order), which is factual curriculum information rather than their prose.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urlparse


@dataclass(frozen=True)
class Source:
    key: str
    name: str
    domain: str
    tier: int
    feed: Optional[str] = None
    company: Optional[str] = None
    topics: List[str] = field(default_factory=list)


# --------------------------------------------------------------------------
# TIER 1 — company engineering blogs (public, attributable)
# --------------------------------------------------------------------------
TIER_1: List[Source] = [
    Source("aws_arch", "AWS Architecture Blog", "aws.amazon.com", 1,
           feed="https://aws.amazon.com/blogs/architecture/feed/",
           company="amazon", topics=["system_design", "core_cs"]),
    Source("netflix_tech", "Netflix TechBlog", "netflixtechblog.com", 1,
           feed="https://netflixtechblog.com/feed",
           topics=["system_design"]),
    Source("meta_eng", "Engineering at Meta", "engineering.fb.com", 1,
           feed="https://engineering.fb.com/feed/",
           company="meta", topics=["system_design", "coding"]),
    # Uber and LinkedIn no longer publish a working public feed (both 404 as of
    # 2026-09). Kept on the allowlist so the live path can still use them; they
    # simply contribute nothing to batch ingestion.
    Source("uber_eng", "Uber Engineering", "www.uber.com", 1,
           company="uber", topics=["system_design"]),
    Source("airbnb_eng", "The Airbnb Tech Blog", "medium.com", 1,
           feed="https://medium.com/feed/airbnb-engineering",
           company="airbnb", topics=["system_design"]),
    Source("linkedin_eng", "LinkedIn Engineering", "www.linkedin.com", 1,
           company="linkedin", topics=["system_design"]),
    Source("microsoft_devblog", "Microsoft Engineering Blog", "devblogs.microsoft.com", 1,
           feed="https://devblogs.microsoft.com/engineering-at-microsoft/feed/",
           company="microsoft", topics=["system_design", "core_cs"]),
    Source("google_research", "Google Research Blog", "research.google", 1,
           feed="https://research.google/blog/rss/",
           company="google", topics=["core_cs", "system_design"]),
    Source("cloudflare_blog", "The Cloudflare Blog", "blog.cloudflare.com", 1,
           feed="https://blog.cloudflare.com/rss/",
           topics=["system_design", "core_cs"]),
    Source("stripe_blog", "Stripe Engineering", "stripe.com", 1,
           feed="https://stripe.com/blog/feed.rss",
           topics=["system_design"]),
    Source("dropbox_tech", "Dropbox Tech Blog", "dropbox.tech", 1,
           feed="https://dropbox.tech/feed",
           topics=["system_design"]),
    Source("slack_eng", "Slack Engineering", "slack.engineering", 1,
           feed="https://slack.engineering/feed/",
           topics=["system_design"]),
    Source("github_blog_eng", "GitHub Engineering", "github.blog", 1,
           feed="https://github.blog/engineering/feed/",
           topics=["system_design", "coding"]),
    # Openly licensed reference material (CC-BY-4.0).
    Source("system_design_primer", "System Design Primer", "raw.githubusercontent.com", 1,
           topics=["system_design"]),
]

# --------------------------------------------------------------------------
# TIER 2 — free public articles, individual sites
# --------------------------------------------------------------------------
TIER_2: List[Source] = [
    # Feed is hosted off-domain (FeedBurner); articles still resolve to
    # martin.kleppmann.com and are allowlist-checked individually.
    Source("martin_kleppmann", "Martin Kleppmann", "martin.kleppmann.com", 2,
           feed="https://feeds.feedburner.com/martinkl", topics=["system_design", "core_cs"]),
    Source("brendangregg", "Brendan Gregg", "www.brendangregg.com", 2,
           feed="https://www.brendangregg.com/blog/rss.xml", topics=["core_cs"]),
]

# --------------------------------------------------------------------------
# TIER 3 — NEVER INGESTED. Taxonomy reference only.
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class TaxonomyOnlySource:
    key: str
    name: str
    domain: str
    reason: str


TIER_3_TAXONOMY_ONLY: List[TaxonomyOnlySource] = [
    TaxonomyOnlySource(
        "leetcode", "LeetCode", "leetcode.com",
        "Editorials and premium content are paid; the ToS prohibits scraping. "
        "Used only for problem/topic taxonomy, never for text.",
    ),
    TaxonomyOnlySource(
        "neetcode", "NeetCode", "neetcode.io",
        "Course content is paid. The roadmap ordering is used as taxonomy; "
        "no prose or video transcript is ingested.",
    ),
    TaxonomyOnlySource(
        "striver_sde", "Striver SDE Sheet", "takeuforward.org",
        "Free articles and paid course material share one domain, so domain-level "
        "tiering cannot separate them and the whole domain is treated as "
        "taxonomy-only. The SDE-sheet problem ordering is used as curriculum "
        "structure; no prose or video transcript is ingested.",
    ),
    TaxonomyOnlySource(
        "youtube", "YouTube transcripts", "youtube.com",
        "Transcript scraping is against the ToS.",
    ),
]

INGESTABLE: List[Source] = TIER_1 + TIER_2
_BY_DOMAIN: Dict[str, Source] = {s.domain: s for s in INGESTABLE}
_BLOCKED_DOMAINS = {t.domain for t in TIER_3_TAXONOMY_ONLY}


def domain_of(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def is_allowed(url: str) -> bool:
    """True only for domains on the ingestable allowlist.

    Deny-by-default: an unknown domain is not fetched. Tier 3 domains are
    rejected even if something else would have allowed them.
    """
    host = domain_of(url)
    if not host:
        return False
    if any(host == d or host.endswith("." + d) for d in _BLOCKED_DOMAINS):
        return False
    return any(host == s.domain or host.endswith("." + s.domain) for s in INGESTABLE)


def source_for(url: str) -> Optional[Source]:
    host = domain_of(url)
    for s in INGESTABLE:
        if host == s.domain or host.endswith("." + s.domain):
            return s
    return None


def feeds() -> List[Source]:
    return [s for s in INGESTABLE if s.feed]


def blocked_reason(url: str) -> Optional[str]:
    host = domain_of(url)
    for t in TIER_3_TAXONOMY_ONLY:
        if host == t.domain or host.endswith("." + t.domain):
            return t.reason
    return None
