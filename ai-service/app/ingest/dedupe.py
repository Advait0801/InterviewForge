"""
Near-duplicate detection via SimHash.

The existing SHA-256 chunk ids already make *exact* re-ingestion idempotent. They
do nothing for near-duplicates, which is what live ingestion actually produces:
the same article syndicated to two domains, a post republished with a new intro,
or boilerplate nav text repeated across every page of a site.

SimHash is used rather than MinHash because it needs no extra dependency, is
~40 lines, and is easy to unit test. Hamming distance on 64-bit fingerprints.
"""
from __future__ import annotations

import hashlib
import re
from typing import Iterable, List, Optional, Sequence, Set, Tuple

_TOKEN_RE = re.compile(r"[a-z0-9]+")
HASH_BITS = 64
DEFAULT_MAX_HAMMING = 3


def tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


def shingles(tokens: Sequence[str], size: int = 3) -> List[str]:
    """Overlapping word n-grams. Word order matters, so reordered text is not
    treated as a duplicate."""
    if len(tokens) < size:
        return [" ".join(tokens)] if tokens else []
    return [" ".join(tokens[i : i + size]) for i in range(len(tokens) - size + 1)]


def simhash(text: str, *, shingle_size: int = 3) -> int:
    feats = shingles(tokenize(text), shingle_size)
    if not feats:
        return 0
    vector = [0] * HASH_BITS
    for feat in feats:
        h = int.from_bytes(hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest(), "big")
        for bit in range(HASH_BITS):
            vector[bit] += 1 if (h >> bit) & 1 else -1
    out = 0
    for bit in range(HASH_BITS):
        if vector[bit] > 0:
            out |= 1 << bit
    return out


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def is_near_duplicate(a: str, b: str, *, max_hamming: int = DEFAULT_MAX_HAMMING) -> bool:
    return hamming(simhash(a), simhash(b)) <= max_hamming


class DuplicateIndex:
    """Accumulates fingerprints and reports whether new text is already covered."""

    def __init__(self, max_hamming: int = DEFAULT_MAX_HAMMING) -> None:
        self.max_hamming = max_hamming
        self._fingerprints: List[Tuple[int, str]] = []

    def add(self, text: str, ref: str = "") -> int:
        fp = simhash(text)
        self._fingerprints.append((fp, ref))
        return fp

    def find_duplicate(self, text: str) -> Optional[str]:
        """Return the ref of an existing near-duplicate, or None."""
        fp = simhash(text)
        if fp == 0:
            return None
        for existing, ref in self._fingerprints:
            if existing == 0:
                continue
            if hamming(fp, existing) <= self.max_hamming:
                return ref or "(unlabelled)"
        return None

    def add_if_new(self, text: str, ref: str = "") -> bool:
        if self.find_duplicate(text) is not None:
            return False
        self.add(text, ref)
        return True

    def __len__(self) -> int:
        return len(self._fingerprints)
