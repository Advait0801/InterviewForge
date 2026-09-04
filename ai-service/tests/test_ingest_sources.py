"""Allowlist is deny-by-default and tier-3 sources are never fetchable."""
import pytest
from app.ingest.sources import (
    INGESTABLE, TIER_1, TIER_2, TIER_3_TAXONOMY_ONLY,
    blocked_reason, domain_of, feeds, is_allowed, source_for,
)


@pytest.mark.parametrize("url", [
    "https://netflixtechblog.com/some-post",
    "https://engineering.fb.com/2024/01/x/",
    "https://aws.amazon.com/blogs/architecture/post",
    "https://blog.cloudflare.com/post",
    "https://martin.kleppmann.com/2020/01/x.html",
])
def test_allowlisted_domains_are_permitted(url):
    assert is_allowed(url)


@pytest.mark.parametrize("url", [
    "https://leetcode.com/problems/two-sum/editorial",
    "https://neetcode.io/courses/advanced-algorithms",
    "https://www.youtube.com/watch?v=abc",
])
def test_tier_three_sources_are_never_allowed(url):
    assert not is_allowed(url)
    assert blocked_reason(url)


@pytest.mark.parametrize("url", [
    "https://evil.example.com/x",
    "https://random-blog.dev/post",
    "https://netflixtechblog.com.attacker.test/x",
    "not-a-url",
    "",
])
def test_unknown_domains_are_denied_by_default(url):
    assert not is_allowed(url)


def test_subdomains_of_allowlisted_hosts_are_permitted():
    assert is_allowed("https://sub.netflixtechblog.com/post")


def test_lookalike_domain_is_not_permitted():
    # "netflixtechblog.com.attacker.test" must not match by suffix confusion.
    assert not is_allowed("https://netflixtechblog.com.attacker.test/x")


def test_domain_of_extracts_host():
    assert domain_of("https://Example.COM/path") == "example.com"
    assert domain_of("garbage") == ""


def test_source_for_returns_the_matching_source():
    src = source_for("https://netflixtechblog.com/post")
    assert src is not None and src.key == "netflix_tech"


def test_feed_urls_are_https():
    # The allowlist gates what gets *ingested*, not which feed we read: a feed
    # can legitimately be hosted off-domain (FeedBurner). Entries returned from
    # a feed are allowlist-filtered individually in fetch_feed_entries.
    for s in feeds():
        assert s.feed.startswith("https://"), f"{s.key} feed is not https"


def test_sources_without_a_feed_are_still_allowlisted():
    # Uber and LinkedIn have no public feed but must remain fetchable by the
    # live path.
    for key in ("uber_eng", "linkedin_eng"):
        src = next(s for s in INGESTABLE if s.key == key)
        assert src.feed is None
        assert is_allowed(f"https://{src.domain}/some-article")


def test_tiers_are_disjoint():
    t1 = {s.key for s in TIER_1}
    t2 = {s.key for s in TIER_2}
    assert not (t1 & t2)


def test_every_tier_three_entry_documents_a_reason():
    for t in TIER_3_TAXONOMY_ONLY:
        assert len(t.reason) > 20, f"{t.key} needs an explanation"


def test_ingestable_excludes_every_tier_three_domain():
    blocked = {t.domain for t in TIER_3_TAXONOMY_ONLY}
    assert not {s.domain for s in INGESTABLE} & blocked
