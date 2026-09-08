"""
Contextual retrieval: situate each chunk before embedding it.

A chunk pulled out of a long article loses the thing that made it findable.
"The autoscaler reacted within 30 seconds" is unsearchable on its own -- nothing
in it says which system, which company, or what problem was being solved. The
fix is to prepend a one-line, LLM-written summary situating the chunk inside its
document, and embed *that* combined text.

Cost is real and paid once at index time: one cheap LLM call per chunk. Calls
are issued concurrently and failures degrade to the bare chunk rather than
aborting the ingest -- a missing context line is a small quality loss, a failed
ingest is a broken corpus.
"""
from __future__ import annotations

import concurrent.futures
import logging
import os
from typing import List, Optional

from app.core import config

log = logging.getLogger(__name__)

CONTEXT_PROMPT = """<document>
{document}
</document>

Here is a chunk from that document:
<chunk>
{chunk}
</chunk>

Write ONE short sentence (max 25 words) that situates this chunk within the
document, so it can be found by search on its own. Name the system, company or
topic the chunk is about. Output only the sentence, no preamble."""

MAX_DOC_CHARS = int(os.getenv("CONTEXTUAL_MAX_DOC_CHARS", "6000"))
WORKERS = int(os.getenv("CONTEXTUAL_WORKERS", "8"))


def _summarise(document: str, chunk: str) -> Optional[str]:
    try:
        from app.llm.chains import _get_llm

        llm = _get_llm(None)
        prompt = CONTEXT_PROMPT.format(document=document[:MAX_DOC_CHARS], chunk=chunk[:4000])
        result = llm.invoke(prompt)
        text = getattr(result, "content", None) or str(result)
        line = " ".join(str(text).split())
        return line[:300] or None
    except Exception as exc:
        log.warning("contextual summary failed: %s", str(exc)[:120])
        return None


def contextualise(document: str, chunks: List[str]) -> List[str]:
    """Return chunks with a situating sentence prepended.

    Order is preserved. Any chunk whose summary fails is returned unchanged.
    """
    if not config.CONTEXTUAL_RETRIEVAL or not chunks:
        return chunks

    out: List[Optional[str]] = [None] * len(chunks)
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {
            pool.submit(_summarise, document, chunk): idx
            for idx, chunk in enumerate(chunks)
        }
        for future in concurrent.futures.as_completed(futures):
            idx = futures[future]
            try:
                summary = future.result()
            except Exception:
                summary = None
            out[idx] = f"{summary}\n\n{chunks[idx]}" if summary else chunks[idx]

    return [text if text is not None else chunks[i] for i, text in enumerate(out)]
