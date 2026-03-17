import chromadb
from chromadb.config import Settings
from app.core import config

def get_chroma_collection():
    client = chromadb.HttpClient(
        host=config.CHROMA_HOST,
        port=config.CHROMA_PORT,
        settings=Settings(anonymized_telemetry=False),
    )
    return client.get_or_create_collection(name=config.CHROMA_COLLECTION)