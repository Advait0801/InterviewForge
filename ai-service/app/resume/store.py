"""Per-user resume vector storage.

This is the only place in the system that stores personal data in the vector
store, so isolation is designed in three independent layers rather than trusting
one filter:

  1. **Physical namespace.** Each user's chunks live in their own Chroma
     collection, `resume_<sha256(user_id)[:32]>`. A query issued against one
     user's collection cannot return another user's chunk however wrong the
     filter is, because the vectors are not in the collection being searched.
  2. **Metadata filter.** Every chunk still carries `user_id`, and every query
     still passes `where={"user_id": {"$eq": ...}}`. Redundant by construction
     -- which is the point: it is the layer that would catch a namespacing bug.
  3. **Egress check.** Every hit is verified against the requesting user before
     it is returned. A mismatch is dropped, counted and logged rather than
     returned, so a leak fails closed and is observable.

Layer 3 exists because layers 1 and 2 are both "we wrote the code correctly"
guarantees, and the failure they guard against is a data breach rather than a
wrong answer. `ISOLATION_VIOLATIONS` is asserted zero by the isolation tests and
exposed at `/metrics/llm` so a violation in production is not silent.

The store takes `user_id` as the first argument of every method and builds the
namespace itself; there is no API through which a caller can name a collection
directly.
"""
from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.core import config
from app.rag.chunking import chunk_text
from app.rag.chroma_client import (
    delete_named_collection,
    get_named_collection,
    get_named_collection_if_exists,
)
from app.rag.embeddings import EmbeddingService

log = logging.getLogger(__name__)

NAMESPACE_PREFIX = "resume_"
_NAMESPACE_RE = re.compile(rf"^{NAMESPACE_PREFIX}[0-9a-f]{{32}}$")

# Incremented whenever a retrieved chunk fails the egress check. Must stay 0.
ISOLATION_VIOLATIONS = 0

# Resume text is short and dense; the corpus chunk size (1200) would put an
# entire experience section in one chunk and lose the per-project precision the
# whole feature depends on.
RESUME_CHUNK_CHARS = 700
RESUME_CHUNK_OVERLAP = 120
RESUME_CHUNK_MIN = 200


class ResumeIsolationError(RuntimeError):
    """Raised when a caller tries to reach the resume store without a user."""


@dataclass
class ResumeStats:
    user_id: str
    namespace: str
    chunk_count: int
    sections: List[str]

    def as_dict(self) -> dict:
        return {
            "userId": self.user_id,
            "namespace": self.namespace,
            "chunkCount": self.chunk_count,
            "sections": self.sections,
        }


def namespace_for(user_id: str) -> str:
    """Hash rather than embed the user id.

    Chroma collection names are visible in admin tooling and constrained to
    `[a-zA-Z0-9._-]`, and a raw uuid would leak user identifiers into that
    surface for no benefit. The hash is deterministic, so lookup needs no index.
    """
    cleaned = (user_id or "").strip()
    if not cleaned:
        raise ResumeIsolationError("resume store requires a user id")
    digest = hashlib.sha256(cleaned.encode("utf-8")).hexdigest()[:32]
    return f"{NAMESPACE_PREFIX}{digest}"


def is_resume_namespace(name: str) -> bool:
    return bool(_NAMESPACE_RE.match(name or ""))


class ResumeStore:
    def __init__(self, embedder: Optional[Any] = None) -> None:
        self.embedder = embedder or EmbeddingService()

    # -- internals ---------------------------------------------------------
    def _collection(self, user_id: str):
        return get_named_collection(namespace_for(user_id))

    @staticmethod
    def _own_filter(user_id: str) -> Dict[str, Any]:
        return {"user_id": {"$eq": user_id}}

    def _enforce_egress(self, user_id: str, hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        global ISOLATION_VIOLATIONS
        safe: List[Dict[str, Any]] = []
        for hit in hits:
            owner = (hit.get("metadata") or {}).get("user_id")
            if owner != user_id:
                ISOLATION_VIOLATIONS += 1
                log.error(
                    "resume isolation violation: chunk owned by %r returned for %r",
                    owner, user_id,
                )
                continue
            safe.append(hit)
        return safe

    # -- write -------------------------------------------------------------
    def ingest(
        self,
        user_id: str,
        *,
        resume_id: str,
        text: str,
        sections: Optional[Dict[str, str]] = None,
    ) -> ResumeStats:
        """Replace this user's resume chunks with the ones from `text`.

        Replace, not append: a user re-uploading a resume means the old one is
        superseded, and leaving both would ground questions in stale projects.
        """
        namespace = namespace_for(user_id)

        ids: List[str] = []
        texts: List[str] = []
        metadatas: List[Dict[str, Any]] = []

        # Chunk per section so each chunk knows which part of the resume it came
        # from -- "which project is this" is exactly what the question generator
        # needs, and it is free at index time.
        blocks = list((sections or {}).items()) or [("resume", text)]
        index = 0
        for section, body in blocks:
            body = (body or "").strip()
            if not body:
                continue
            parts = chunk_text(
                body,
                chunk_size=RESUME_CHUNK_CHARS,
                overlap=RESUME_CHUNK_OVERLAP,
                min_size=RESUME_CHUNK_MIN,
            )
            for part in parts:
                part = part.strip()
                if not part:
                    continue
                stable = f"{namespace}::{resume_id}::{index}::{part}"
                ids.append(hashlib.sha256(stable.encode("utf-8")).hexdigest())
                texts.append(part)
                metadatas.append(
                    {
                        "user_id": user_id,
                        "resume_id": resume_id,
                        "section": section,
                        "source": f"resume:{resume_id}",
                        "chunk_index": index,
                        "origin": "resume",
                    }
                )
                index += 1

        if not ids:
            return ResumeStats(user_id=user_id, namespace=namespace, chunk_count=0, sections=[])

        # Embed BEFORE purging. Embedding is the step that reaches a provider and
        # is therefore the step that fails; purging first would mean a provider
        # outage during a re-upload destroys the resume the user already had.
        vectors = self.embedder.embed(texts)

        self.purge(user_id)
        collection = get_named_collection(namespace)
        collection.upsert(ids=ids, documents=texts, embeddings=vectors, metadatas=metadatas)

        return ResumeStats(
            user_id=user_id,
            namespace=namespace,
            chunk_count=len(ids),
            sections=sorted({m["section"] for m in metadatas}),
        )

    # -- read --------------------------------------------------------------
    def retrieve(self, user_id: str, query: str, *, top_k: int = 4) -> List[Dict[str, Any]]:
        namespace = namespace_for(user_id)
        try:
            collection = get_named_collection_if_exists(namespace)
            if collection is None:
                return []
            qvec = self.embedder.embed([query])[0]
            result = collection.query(
                query_embeddings=[qvec],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
                where=self._own_filter(user_id),
            )
        except Exception as exc:
            # A missing namespace is the normal case for a user with no resume.
            log.info("resume retrieval unavailable for namespace %s: %s", namespace, str(exc)[:160])
            return []

        hits: List[Dict[str, Any]] = []
        ids = (result.get("ids") or [[]])[0]
        for i in range(len(ids)):
            hits.append(
                {
                    "id": ids[i],
                    "text": result["documents"][0][i],
                    "metadata": result["metadatas"][0][i],
                    "distance": result["distances"][0][i],
                }
            )
        return self._enforce_egress(user_id, hits)

    def stats(self, user_id: str) -> ResumeStats:
        namespace = namespace_for(user_id)
        empty = ResumeStats(user_id=user_id, namespace=namespace, chunk_count=0, sections=[])
        try:
            collection = get_named_collection_if_exists(namespace)
            if collection is None:
                return empty
            found = collection.get(where=self._own_filter(user_id), include=["metadatas"])
        except Exception:
            return empty
        metadatas = found.get("metadatas") or []
        return ResumeStats(
            user_id=user_id,
            namespace=namespace,
            chunk_count=len(found.get("ids") or []),
            sections=sorted({m.get("section", "resume") for m in metadatas}),
        )

    # -- delete ------------------------------------------------------------
    def purge(self, user_id: str) -> Dict[str, Any]:
        """Delete every vector belonging to this user, namespace included.

        The collection itself is dropped rather than emptied. Deleting ids alone
        would leave an empty collection behind that still names the user's
        namespace, and "the row is gone but the container remains" is not what a
        deletion request means.
        """
        namespace = namespace_for(user_id)
        before = self.stats(user_id).chunk_count
        dropped = delete_named_collection(namespace)
        return {"namespace": namespace, "deletedChunks": before, "namespaceDropped": dropped}
