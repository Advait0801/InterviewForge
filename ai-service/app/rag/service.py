import hashlib
from typing import List, Dict, Any, Optional
from app.core import config
from app.rag.chunking import chunk_text
from app.rag.embeddings import EmbeddingService
from app.rag.chroma_client import get_chroma_collection

class RAGService:
    def __init__(self) -> None:
        self.collection = get_chroma_collection()
        self.embedder = EmbeddingService()

    def ingest_documents(self, docs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        docs: [{ "source": "...", "text": "...", "metadata": {...} }]
        """
        ids: List[str] = []
        texts: List[str] = []
        metadatas: List[dict] = []

        for d in docs:
            source = str(d.get("source", "unknown"))
            text = str(d.get("text", "")).strip()
            base_metadata = dict(d.get("metadata", {}) or {})
            if not text:
                continue

            parts = chunk_text(
                text,
                chunk_size=config.CHUNK_SIZE_CHARS,
                overlap=config.CHUNK_OVERLAP_CHARS,
            )

            for idx, part in enumerate(parts):
                stable = f"{source}::{idx}::{part}"
                cid = hashlib.sha256(stable.encode("utf-8")).hexdigest()
                ids.append(cid)
                texts.append(part)
                metadatas.append({
                    "source": source,
                    "chunk_index": idx,
                    **base_metadata,
                })

        if not ids:
            return {"ingested": 0}

        vectors = self.embedder.embed(texts)

        # Upsert
        self.collection.upsert(
            ids=ids,
            documents=texts,
            embeddings=vectors,
            metadatas=metadatas,
        )

        return {"ingested": len(ids)}

    def source_exists(self, source: str) -> bool:
        """Has anything from this source id already been ingested?

        Chunk ids hash the chunk *text*, which makes exact re-ingestion
        idempotent only if the page is byte-identical. Many sites inject
        dynamic content (recommendation rails, counters), so the same URL
        re-fetched yields slightly different text, new chunk ids, and unbounded
        growth. Source ids are derived from the URL and are therefore stable, so
        they are the right identity for "have we already got this article?".
        """
        try:
            found = self.collection.get(where={"source": source}, limit=1)
            return bool(found.get("ids"))
        except Exception:
            return False

    def delete_source(self, source: str) -> int:
        """Remove every chunk belonging to a source id. Returns count removed."""
        try:
            found = self.collection.get(where={"source": source})
            ids = found.get("ids") or []
            if ids:
                self.collection.delete(ids=ids)
            return len(ids)
        except Exception:
            return 0

    def retrieve(self, query: str, *, top_k: int, where: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        qvec = self.embedder.embed([query])[0]
        result = self.collection.query(
            query_embeddings=[qvec],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
            where=where,
        )

        hits = []
        for i in range(len(result["ids"][0])):
            hits.append(
                {
                    "id": result["ids"][0][i],
                    "text": result["documents"][0][i],
                    "metadata": result["metadatas"][0][i],
                    "distance": result["distances"][0][i],
                }
            )

        return {"query": query, "top_k": top_k, "where": where, "hits": hits}