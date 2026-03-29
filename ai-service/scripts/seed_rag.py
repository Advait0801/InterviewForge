#!/usr/bin/env python3
"""
Seed the RAG vector store with interview knowledge documents.

Usage:
    python scripts/seed_rag.py                     # defaults to http://localhost:8000
    python scripts/seed_rag.py --url http://ai-service:8000
    docker compose exec ai-service python scripts/seed_rag.py --url http://localhost:8000
"""

import argparse
import json
import sys
from pathlib import Path

import requests

SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed_data"


def main():
    parser = argparse.ArgumentParser(description="Seed RAG with interview documents")
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="AI service base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--file",
        default=str(SEED_DATA_DIR / "documents.json"),
        help="Path to seed documents JSON file",
    )
    args = parser.parse_args()

    docs_path = Path(args.file)
    if not docs_path.exists():
        print(f"Error: seed file not found at {docs_path}", file=sys.stderr)
        sys.exit(1)

    with open(docs_path) as f:
        documents = json.load(f)

    print(f"Loaded {len(documents)} documents from {docs_path}")

    ingest_url = f"{args.url.rstrip('/')}/api/rag/ingest"
    print(f"Ingesting into {ingest_url} ...")

    try:
        resp = requests.post(ingest_url, json={"documents": documents}, timeout=120)
        resp.raise_for_status()
        result = resp.json()
        print(f"Success: {json.dumps(result, indent=2)}")
    except requests.exceptions.ConnectionError:
        print(f"Error: cannot connect to {ingest_url}. Is the AI service running?", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(f"Error: {e.response.status_code} — {e.response.text}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
