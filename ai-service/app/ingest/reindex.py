"""
Re-index the corpus under a different chunking strategy.

Comparing chunking strategies requires re-chunking *the same documents*. Chroma
stores chunks, not originals, and re-fetching from feeds would return a
different article set -- which would silently invalidate the comparison. So:

  snapshot  -- fetch every ingested source_url once and cache the extracted text
               to disk, alongside the seed corpus.
  reindex   -- drop the collection and rebuild it from the cache using whatever
               CHUNK_STRATEGY is currently configured.

The cache is what makes the A/B honest: every strategy is measured against
byte-identical source documents.

    python -m app.ingest.reindex --snapshot     # build/refresh the cache
    python -m app.ingest.reindex --rebuild      # rebuild Chroma from the cache
"""
from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict, List

from app.core import config
from app.rag.chroma_client import get_chroma_collection
from app.rag.service import RAGService

CACHE_DIR = os.getenv("CORPUS_CACHE_DIR", "/app/.corpus_cache")
CACHE_FILE = os.path.join(CACHE_DIR, "documents.json")
SEED_FILE = "/app/seed_data/documents.json"


def _stored_documents() -> List[Dict[str, Any]]:
    """One record per distinct ingested source, from Chroma metadata."""
    collection = get_chroma_collection()
    got = collection.get(include=["metadatas"], limit=100_000)
    by_source: Dict[str, Dict[str, Any]] = {}
    for meta in got.get("metadatas") or []:
        source = str(meta.get("source", ""))
        if not source or source in by_source:
            continue
        if not source.startswith(("batch::", "live::")):
            continue  # seed docs come from the seed file, not a refetch
        by_source[source] = {
            "source": source,
            "url": meta.get("source_url"),
            "company": meta.get("company", ""),
            "stage": meta.get("stage", ""),
            "origin": meta.get("origin", "batch"),
            "title": meta.get("title", ""),
            "reviewed": meta.get("reviewed", True),
        }
    return [d for d in by_source.values() if d["url"]]


def _reconstruct_from_chunks(source: str, *, overlap: int) -> str:
    """Stitch a document back together from its stored chunks.

    Used when a URL can no longer be re-fetched (Medium in particular rejects
    the canonicalised URL for some articles). Without this, those documents
    would vanish from the rebuilt corpus and the chunking comparison would be
    measuring corpus loss rather than chunking.

    Consecutive chunks share up to `overlap` characters, so the shared region is
    detected and removed rather than duplicated.
    """
    collection = get_chroma_collection()
    got = collection.get(where={"source": source}, include=["documents", "metadatas"], limit=10_000)
    pairs = sorted(
        zip(got.get("documents") or [], got.get("metadatas") or []),
        key=lambda pair: pair[1].get("chunk_index", 0),
    )
    if not pairs:
        return ""

    text = pairs[0][0]
    for chunk, _meta in pairs[1:]:
        best = 0
        for k in range(min(len(text), len(chunk), overlap + 100), 20, -1):
            if text.endswith(chunk[:k]):
                best = k
                break
        text += chunk[best:]
    return text


def snapshot() -> Dict[str, int]:
    """Fetch and cache the full text of every ingested document."""
    from app.ingest import fetch as fetchmod

    os.makedirs(CACHE_DIR, exist_ok=True)
    existing: Dict[str, Any] = {}
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as fh:
            existing = {d["source"]: d for d in json.load(fh)}

    stats = {"total": 0, "cached": 0, "fetched": 0, "reconstructed": 0, "failed": 0}
    for record in _stored_documents():
        stats["total"] += 1
        if record["source"] in existing and existing[record["source"]].get("text"):
            stats["cached"] += 1
            continue
        try:
            page = fetchmod.fetch_page(record["url"])
            record["text"] = page.text
            record["title"] = page.title or record.get("title", "")
            existing[record["source"]] = record
            stats["fetched"] += 1
            continue
        except Exception as exc:
            rebuilt = _reconstruct_from_chunks(record["source"], overlap=config.CHUNK_OVERLAP_CHARS)
            if rebuilt:
                print(f"  RECONSTRUCTED {record['url'][:60]} ({type(exc).__name__})")
                record["text"] = rebuilt
                existing[record["source"]] = record
                stats["reconstructed"] += 1
            else:
                print(f"  FAIL {record['url'][:66]}: {type(exc).__name__}")
                stats["failed"] += 1
            continue
        record["text"] = page.text
        record["title"] = page.title or record.get("title", "")
        existing[record["source"]] = record
        stats["fetched"] += 1

    with open(CACHE_FILE, "w") as fh:
        json.dump(list(existing.values()), fh)
    return stats


def rebuild(*, drop: bool = True) -> Dict[str, Any]:
    """Rebuild the collection from the seed file plus the cached documents."""
    import chromadb

    if drop:
        client = chromadb.HttpClient(host=config.CHROMA_HOST, port=config.CHROMA_PORT)
        try:
            client.delete_collection(config.CHROMA_COLLECTION)
        except Exception:
            pass

    rag = RAGService()

    with open(SEED_FILE) as fh:
        seed_docs = json.load(fh)
    seed_written = rag.ingest_documents(seed_docs)

    ingested_written = {"ingested": 0}
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as fh:
            cached = json.load(fh)
        docs = [
            {
                "source": d["source"],
                "text": d["text"],
                "metadata": {
                    "company": d.get("company", ""),
                    "stage": d.get("stage", ""),
                    "type": "engineering_blog",
                    "origin": d.get("origin", "batch"),
                    "reviewed": d.get("reviewed", True),
                    "source_url": d.get("url", ""),
                    "title": str(d.get("title", ""))[:300],
                },
            }
            for d in cached
            if d.get("text")
        ]
        ingested_written = rag.ingest_documents(docs)

    return {
        "strategy": config.CHUNK_STRATEGY,
        "chunk_size": config.CHUNK_SIZE_CHARS,
        "seed_chunks": seed_written.get("ingested", 0),
        "ingested_chunks": ingested_written.get("ingested", 0),
        "total": get_chroma_collection().count(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", action="store_true")
    ap.add_argument("--rebuild", action="store_true")
    args = ap.parse_args()

    if args.snapshot:
        print("snapshot:", snapshot())
    if args.rebuild:
        print("rebuild:", rebuild())
    if not args.snapshot and not args.rebuild:
        ap.error("choose --snapshot and/or --rebuild")


if __name__ == "__main__":
    main()
