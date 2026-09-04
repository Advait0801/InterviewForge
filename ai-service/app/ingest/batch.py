"""
Nightly batch ingestion of the curated core.

    python -m app.ingest.batch                 # all feeds
    python -m app.ingest.batch --source aws_arch --limit 5
    python -m app.ingest.batch --dry-run

Batch content is tagged origin="batch", reviewed=True: these are hand-picked
sources, unlike the live path.
"""
from __future__ import annotations

import argparse
import logging
import sys
from typing import Dict, List, Optional

from app.ingest import fetch as fetchmod
from app.ingest.dedupe import DuplicateIndex
from app.ingest.live import canonical_url, url_key
from app.ingest.sources import feeds
from app.rag.service import RAGService

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("batch")


def run(
    *,
    source_key: Optional[str] = None,
    per_feed: int = 5,
    dry_run: bool = False,
    force: bool = False,
) -> Dict[str, int]:
    rag = None if dry_run else RAGService()
    dupes = DuplicateIndex()
    stats = {"feeds": 0, "urls": 0, "pages": 0, "chunks": 0, "skipped": 0, "already_have": 0}

    for source in feeds():
        if source_key and source.key != source_key:
            continue
        stats["feeds"] += 1
        log.info("feed: %s (%s)", source.name, source.feed)
        try:
            urls: List[str] = fetchmod.fetch_feed_entries(source.feed, limit=per_feed)
        except Exception as exc:
            log.warning("  feed failed: %s", exc)
            continue

        stats["urls"] += len(urls)
        docs = []
        for url in urls:
            source_id = f"batch::{source.key}::{url_key(url)}"
            if rag is not None and not force and rag.source_exists(source_id):
                log.info("  already have: %s", url)
                stats["already_have"] += 1
                continue
            try:
                page = fetchmod.fetch_page(url)
            except fetchmod.FetchRefused as exc:
                log.info("  skip: %s", exc)
                stats["skipped"] += 1
                continue
            except Exception as exc:
                log.info("  skip %s: %s", url, type(exc).__name__)
                stats["skipped"] += 1
                continue

            if not dupes.add_if_new(page.text, ref=page.url):
                log.info("  skip near-duplicate: %s", url)
                stats["skipped"] += 1
                continue

            log.info("  ok: %s (%d chars)", page.title[:70] or url, len(page.text))
            if rag is not None and force:
                rag.delete_source(source_id)

            docs.append(
                {
                    "source": source_id,
                    "text": page.text,
                    "metadata": {
                        "company": page.company or source.company or "",
                        "stage": (source.topics[0] if source.topics else ""),
                        "type": "engineering_blog",
                        "origin": "batch",
                        "reviewed": True,
                        "source_url": canonical_url(page.url),
                        "title": page.title[:300],
                        "ingested_at": page.fetched_at,
                    },
                }
            )

        stats["pages"] += len(docs)
        if docs and not dry_run:
            written = rag.ingest_documents(docs)
            stats["chunks"] += int(written.get("ingested", 0))

    return stats


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=str, default=None)
    ap.add_argument("--limit", type=int, default=5, help="articles per feed")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="re-ingest even if the article is already stored")
    args = ap.parse_args()

    stats = run(source_key=args.source, per_feed=args.limit,
                dry_run=args.dry_run, force=args.force)
    print("\n" + " | ".join(f"{k}={v}" for k, v in stats.items()))
    if stats["pages"] == 0 and stats["already_have"] == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
