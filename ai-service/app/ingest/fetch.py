"""
HTTP fetching and HTML -> text extraction.

Rules enforced here, not left to callers:
  - deny-by-default allowlist (app.ingest.sources)
  - robots.txt is honoured, with results cached per host
  - hard per-request timeout so a slow site cannot stall an interview
  - response size cap so a huge page cannot blow up memory
  - identifying User-Agent
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from app.ingest.sources import blocked_reason, domain_of, is_allowed, source_for

USER_AGENT = os.getenv(
    "INGEST_USER_AGENT",
    "InterviewForgeBot/1.0 (+https://github.com/Advait0801/InterviewForge; research/education)",
)
FETCH_TIMEOUT_SECONDS = float(os.getenv("INGEST_FETCH_TIMEOUT_SECONDS", "8"))
MAX_BYTES = int(os.getenv("INGEST_MAX_BYTES", str(2_000_000)))
MIN_TEXT_CHARS = int(os.getenv("INGEST_MIN_TEXT_CHARS", "400"))


class FetchRefused(Exception):
    """Raised when a URL must not be fetched at all."""


@dataclass
class FetchedPage:
    url: str
    title: str
    text: str
    source_key: Optional[str]
    company: Optional[str]
    fetched_at: float


_robots_cache: Dict[str, RobotFileParser] = {}


def _robots_for(url: str) -> Optional[RobotFileParser]:
    host = domain_of(url)
    if host in _robots_cache:
        return _robots_cache[host]
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotFileParser()
    try:
        with httpx.Client(timeout=FETCH_TIMEOUT_SECONDS, headers={"User-Agent": USER_AGENT}) as c:
            resp = c.get(robots_url)
        if resp.status_code == 200:
            rp.parse(resp.text.splitlines())
        else:
            # No robots.txt is permission by convention.
            rp.parse([])
    except Exception:
        # If robots cannot be read, fail closed for that host.
        return None
    _robots_cache[host] = rp
    return rp


def may_fetch(url: str) -> tuple[bool, str]:
    reason = blocked_reason(url)
    if reason:
        return False, f"tier-3 source, not ingestable: {reason}"
    if not is_allowed(url):
        return False, "domain is not on the ingest allowlist"
    rp = _robots_for(url)
    if rp is None:
        return False, "robots.txt unreadable, failing closed"
    if not rp.can_fetch(USER_AGENT, url):
        return False, "disallowed by robots.txt"
    return True, "allowed"


def extract_text(html: str) -> tuple[str, str]:
    """Return (title, main text) with nav/script/style boilerplate removed."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")

    # Prefer og:title, then the first h1, then <title>. Platforms like Medium
    # set a generic <title> ("Medium") on every article, so trusting it would
    # label every page identically.
    title = ""
    og = soup.find("meta", attrs={"property": "og:title"})
    if og and og.get("content"):
        title = og["content"].strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(" ", strip=True)
    if not title and soup.title:
        title = soup.title.get_text(strip=True)

    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "noscript"]):
        tag.decompose()

    main = soup.find("article") or soup.find("main") or soup.body or soup
    parts: List[str] = []
    for el in main.find_all(["h1", "h2", "h3", "p", "li", "pre"]):
        chunk = el.get_text(" ", strip=True)
        if len(chunk) > 2:
            parts.append(chunk)

    text = "\n".join(parts)
    # Collapse runaway blank space without destroying paragraph structure.
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return title, text.strip()


def fetch_page(url: str) -> FetchedPage:
    allowed, reason = may_fetch(url)
    if not allowed:
        raise FetchRefused(f"{url}: {reason}")

    with httpx.Client(
        timeout=FETCH_TIMEOUT_SECONDS,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        resp = client.get(url)
        resp.raise_for_status()
        # Re-check after redirects: a redirect must not escape the allowlist.
        final = str(resp.url)
        ok, why = may_fetch(final)
        if not ok:
            raise FetchRefused(f"{final}: redirect left the allowlist ({why})")
        content = resp.content[:MAX_BYTES]

    title, text = extract_text(content.decode(resp.encoding or "utf-8", errors="replace"))
    if len(text) < MIN_TEXT_CHARS:
        raise FetchRefused(f"{url}: extracted only {len(text)} chars, below minimum")

    src = source_for(final)
    return FetchedPage(
        url=final,
        title=title,
        text=text,
        source_key=src.key if src else None,
        company=src.company if src else None,
        fetched_at=time.time(),
    )


def fetch_feed_entries(feed_url: str, *, limit: int = 10) -> List[str]:
    """Return recent article URLs from an RSS/Atom feed, allowlist-filtered."""
    import feedparser

    with httpx.Client(timeout=FETCH_TIMEOUT_SECONDS, headers={"User-Agent": USER_AGENT},
                      follow_redirects=True) as client:
        resp = client.get(feed_url)
        resp.raise_for_status()
        raw = resp.content[:MAX_BYTES]

    parsed = feedparser.parse(raw)
    urls: List[str] = []
    for entry in parsed.entries[:limit]:
        link = entry.get("link")
        if link and is_allowed(link):
            urls.append(link)
    return urls
