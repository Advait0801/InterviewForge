import os

AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))

CHROMA_HOST = os.getenv("CHROMA_HOST", "chromadb")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "interviewforge_docs")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Models
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
OPENAI_EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

# Provider strategy
LLM_PROVIDER_ORDER = [
    provider.strip().lower()
    for provider in os.getenv("LLM_PROVIDER_ORDER", "gemini,openai").split(",")
    if provider.strip()
]
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai").strip().lower()

# RAG defaults
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
CHUNK_SIZE_CHARS = int(os.getenv("CHUNK_SIZE_CHARS", "1200"))
CHUNK_OVERLAP_CHARS = int(os.getenv("CHUNK_OVERLAP_CHARS", "200"))
# "character" (flat recursive splitting) or "structural" (headings/paragraphs first).
CHUNK_STRATEGY = os.getenv("CHUNK_STRATEGY", "structural").strip().lower()
# Sections shorter than this are merged into their neighbour rather than stored
# as standalone fragments.
CHUNK_MIN_CHARS = int(os.getenv("CHUNK_MIN_CHARS", "350"))

# Small-to-big retrieval: embed small chunks for precision, then expand each hit
# to include its neighbouring chunks from the same document before handing the
# text to the LLM. 0 disables expansion.
# 1 measured best: sufficiency 3.38 -> 4.50 at 2.06x context. Window 2 scored
# *lower* (4.00) on 28% more text -- context dilution, not a monotonic win.
PARENT_WINDOW = int(os.getenv("PARENT_WINDOW", "1"))

# Contextual retrieval: prepend an LLM-written situating sentence to each chunk
# before embedding. Costs one cheap LLM call per chunk at index time.
CONTEXTUAL_RETRIEVAL = os.getenv("CONTEXTUAL_RETRIEVAL", "false").strip().lower() in ("1", "true", "yes")

# --- query-side retrieval (Phase 3) -----------------------------------------
# Second-stage reranking: retrieve RERANK_CANDIDATES cheaply, rerank, keep top_k.
RERANK_ENABLED = os.getenv("RERANK_ENABLED", "false").strip().lower() in ("1", "true", "yes")
RERANK_CANDIDATES = int(os.getenv("RERANK_CANDIDATES", "20"))
# Hybrid dense + BM25 fused with Reciprocal Rank Fusion.
HYBRID_ENABLED = os.getenv("HYBRID_ENABLED", "false").strip().lower() in ("1", "true", "yes")
HYBRID_CANDIDATES = int(os.getenv("HYBRID_CANDIDATES", "40"))
RRF_K = int(os.getenv("RRF_K", "60"))
# Maximal Marginal Relevance: trade a little relevance for less redundancy.
MMR_ENABLED = os.getenv("MMR_ENABLED", "false").strip().lower() in ("1", "true", "yes")
MMR_LAMBDA = float(os.getenv("MMR_LAMBDA", "0.7"))
# Per-stage routing: pick the retrieval strategy from the interview stage
# instead of applying one policy everywhere.
ROUTING_ENABLED = os.getenv("ROUTING_ENABLED", "true").strip().lower() in ("1", "true", "yes")
RERANK_TIMEOUT_SECONDS = float(os.getenv("RERANK_TIMEOUT_SECONDS", "5.0"))