from dataclasses import dataclass
from typing import List

@dataclass(frozen=True)
class Chunk:
    id: str
    text: str
    metadata: dict

def simple_chunk_text(text: str, *, chunk_size: int, overlap: int) -> List[str]:
    text = text.strip()
    if not text:
        return []
    chunks = []
    i = 0
    n = len(text)
    while i < n:
        j = min(i + chunk_size, n)
        chunks.append(text[i:j])
        if j == n:
            break
        i = max(0, j - overlap)
    return chunks