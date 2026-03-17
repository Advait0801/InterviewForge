from dataclasses import dataclass
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass(frozen=True)
class Chunk:
    id: str
    text: str
    metadata: dict


def chunk_text(text: str, *, chunk_size: int, overlap: int) -> List[str]:
    """
    Split text using RecursiveCharacterTextSplitter which respects natural
    boundaries (paragraphs -> newlines -> sentences -> words) instead of
    cutting at a fixed character offset.
    """
    text = text.strip()
    if not text:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", ", ", " ", ""],
        length_function=len,
        is_separator_regex=False,
    )
    return splitter.split_text(text)
