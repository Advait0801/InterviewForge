import chromadb
from chromadb.config import Settings
from app.core import config

_client = None


def get_chroma_client():
    """One HttpClient per process. Chroma's client is thread-safe and holds a
    connection pool, so building a new one per request is pure overhead."""
    global _client
    if _client is None:
        _client = chromadb.HttpClient(
            host=config.CHROMA_HOST,
            port=config.CHROMA_PORT,
            settings=Settings(anonymized_telemetry=False),
        )
    return _client


def get_chroma_collection():
    return get_chroma_client().get_or_create_collection(name=config.CHROMA_COLLECTION)


def get_named_collection(name: str):
    """Get or create. Use only on write paths -- see the read variant below."""
    return get_chroma_client().get_or_create_collection(name=name)


def get_named_collection_if_exists(name: str):
    """Look a collection up WITHOUT creating it, returning None if absent.

    `get_or_create_collection` on a read path is a trap: merely asking whether a
    user has a resume would materialise an empty collection named after them.
    That left a namespace behind after deletion -- the DELETE handler verifies
    the purge by reading back, which re-created the very collection it had just
    dropped -- and an empty namespace still discloses that the user once had a
    resume.
    """
    try:
        return get_chroma_client().get_collection(name=name)
    except Exception:
        return None


def delete_named_collection(name: str) -> bool:
    """Drop a whole collection. Returns False if it did not exist."""
    try:
        get_chroma_client().delete_collection(name=name)
        return True
    except Exception:
        return False


def list_collection_names() -> list:
    try:
        # Chroma 0.5 returns Collection objects here; newer versions return
        # plain names. Accept both so a client bump does not break isolation
        # auditing.
        return [getattr(c, "name", c) for c in get_chroma_client().list_collections()]
    except Exception:
        return []
