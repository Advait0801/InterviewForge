"""
Confidence-triggered live ingestion with write-back.

    query -> local retrieval
          -> confident?  yes -> use it (~50ms, the normal path)
                          no -> discover URLs -> fetch -> extract -> dedupe
                                -> embed -> WRITE BACK to Chroma -> retrieve again

The write-back is the point: this is a read-through cache over the vector store.
The first person to ask about a thinly-covered topic pays the latency once;
everyone after gets the fast path, and the corpus grows around real demand.

Everything written by this path is tagged `origin="live"` and `reviewed=False`,
so a bad ingestion run is reversible (delete unreviewed chunks in a date range)
and retrieval can be measured with and without live content.
"""
from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.ingest import fetch as fetchmod
from app.ingest.dedupe import DuplicateIndex
from app.ingest.limits import LimitExceeded, limiter
from app.ingest.sources import is_allowed

log = logging.getLogger(__name__)

MAX_PAGES_PER_FETCH = int(os.getenv("LIVE_FETCH_MAX_PAGES", "3"))
DISCOVERY_ENABLED = os.getenv("LIVE_FETCH_DISCOVERY", "gemini").strip().lower()


@dataclass
class LiveResult:
    triggered: bool
    reason: str
    urls_considered: List[str] = field(default_factory=list)
    pages_ingested: int = 0
    chunks_written: int = 0
    skipped: List[Dict[str, str]] = field(default_factory=list)
    error: Optional[str] = None

    def as_dict(self) -> Dict[str, Any]:
        return {
            "triggered": self.triggered,
            "reason": self.reason,
            "urls_considered": self.urls_considered,
            "pages_ingested": self.pages_ingested,
            "chunks_written": self.chunks_written,
            "skipped": self.skipped,
            "error": self.error,
        }


# Query/tracking params that identify a *visit*, not a document. Medium appends a
# random `gi` token on every redirect, so hashing the raw URL gives the same
# article a new identity on each fetch and re-ingestion silently duplicates it.
_TRACKING_PARAMS = {
    "gi", "source", "sk", "ref", "referrer", "fbclid", "gclid", "mc_cid", "mc_eid",
    "igshid", "spm", "_hsenc", "_hsmi",
}


def canonical_url(url: str) -> str:
    """Strip tracking parameters, fragments and trailing slashes.

    Two URLs that differ only by tracking noise must produce the same document
    identity, or every re-ingest duplicates the corpus.
    """
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

    parts = urlsplit(url)
    kept = [
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in _TRACKING_PARAMS and not k.lower().startswith("utm_")
    ]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((
        parts.scheme.lower(),
        parts.netloc.lower(),
        path,
        urlencode(sorted(kept)),
        "",  # drop the fragment
    ))


def query_key(query: str) -> str:
    return hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()[:32]


def url_key(url: str) -> str:
    """Stable identity for a document, derived from its canonical URL."""
    return hashlib.sha256(canonical_url(url).encode("utf-8")).hexdigest()[:32]


def discover_urls(query: str, *, limit: int = MAX_PAGES_PER_FETCH) -> List[str]:
    """Find candidate URLs for a query.

    Uses Gemini's Google Search grounding, which avoids taking on a separate
    search-API dependency and key. Results are filtered through the allowlist, so
    discovery can propose anything and only permitted domains survive.
    """
    if DISCOVERY_ENABLED == "off":
        return []
    try:
        from google import genai
        from google.genai import types

        from app.core import config

        client = genai.Client(api_key=config.GEMINI_API_KEY)
        resp = client.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=(
                "Find authoritative engineering-blog articles for this technical "
                f"interview topic. Reply with URLs only.\n\nTopic: {query}"
            ),
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
        urls: List[str] = []
        for cand in getattr(resp, "candidates", []) or []:
            meta = getattr(cand, "grounding_metadata", None)
            for chunk in (getattr(meta, "grounding_chunks", None) or []):
                web = getattr(chunk, "web", None)
                uri = getattr(web, "uri", None) if web else None
                if uri and uri not in urls:
                    urls.append(uri)
        return urls[: limit * 4]  # over-fetch; most will fail the allowlist
    except Exception as exc:  # discovery must never break the interview
        log.warning("live discovery failed: %s", exc)
        return []


def ingest_urls(
    rag,
    urls: List[str],
    *,
    company: Optional[str],
    stage: Optional[str],
    limit: int = MAX_PAGES_PER_FETCH,
) -> LiveResult:
    """Fetch, dedupe and write back a set of candidate URLs."""
    result = LiveResult(triggered=True, reason="ingesting", urls_considered=list(urls))
    dupes = DuplicateIndex()
    docs: List[Dict[str, Any]] = []

    for url in urls:
        if len(docs) >= limit:
            break
        if not is_allowed(url):
            result.skipped.append({"url": url, "why": "not on allowlist"})
            continue
        try:
            page = fetchmod.fetch_page(url)
        except fetchmod.FetchRefused as exc:
            result.skipped.append({"url": url, "why": str(exc)})
            continue
        except Exception as exc:
            result.skipped.append({"url": url, "why": f"fetch error: {type(exc).__name__}"})
            continue

        source_id = f"live::{page.source_key or 'unknown'}::{url_key(page.url)}"
        if getattr(rag, "source_exists", None) and rag.source_exists(source_id):
            result.skipped.append({"url": url, "why": "already ingested"})
            continue

        if not dupes.add_if_new(page.text, ref=page.url):
            result.skipped.append({"url": url, "why": "near-duplicate of another fetched page"})
            continue

        docs.append(
            {
                "source": source_id,
                "text": page.text,
                "metadata": {
                    "company": (page.company or company or ""),
                    "stage": stage or "",
                    "type": "engineering_blog",
                    "origin": "live",
                    "reviewed": False,
                    "source_url": canonical_url(page.url),
                    "title": page.title[:300],
                    "ingested_at": page.fetched_at,
                },
            }
        )

    if not docs:
        result.reason = "no ingestable pages found"
        return result

    ingested = rag.ingest_documents(docs)
    result.pages_ingested = len(docs)
    result.chunks_written = int(ingested.get("ingested", 0))
    result.reason = f"ingested {result.pages_ingested} page(s)"
    return result


def maybe_fetch(
    rag,
    *,
    query: str,
    company: Optional[str] = None,
    stage: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> LiveResult:
    """Run the live path, respecting every limit. Never raises."""
    key = query_key(query)
    try:
        limiter.acquire(user_id=user_id, session_id=session_id, query_key=key)
    except LimitExceeded as exc:
        return LiveResult(triggered=False, reason=str(exc))

    try:
        urls = discover_urls(query)
        if not urls:
            return LiveResult(triggered=True, reason="discovery returned no candidates")
        return ingest_urls(rag, urls, company=company, stage=stage)
    except Exception as exc:
        log.exception("live fetch failed")
        return LiveResult(triggered=True, reason="live fetch failed", error=str(exc))
    finally:
        limiter.release()
