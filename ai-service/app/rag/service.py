import hashlib
from typing import List, Dict, Any
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
        docs: [{ "source": "...", "text": "..." }]
        """
        ids: List[str] = []
        texts: List[str] = []
        metadatas: List[dict] = []

        for d in docs:
            source = str(d.get("source", "unknown"))
            text = str(d.get("text", "")).strip()
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
                metadatas.append({"source": source, "chunk_index": idx})

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

    def retrieve(self, query: str, *, top_k: int) -> Dict[str, Any]:
        qvec = self.embedder.embed([query])[0]
        result = self.collection.query(
            query_embeddings=[qvec],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
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

        return {"query": query, "top_k": top_k, "hits": hits}