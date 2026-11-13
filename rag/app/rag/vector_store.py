from functools import lru_cache

from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from app.base.llm import embeddings
from app.config import settings


@lru_cache
def vector_store() -> QdrantVectorStore:
    """Shared by indexing and retrieval."""
    emb = embeddings()
    client = QdrantClient(url=settings.qdrant_url)
    if not client.collection_exists(settings.qdrant_collection):
        dim = len(emb.embed_query("init"))
        client.create_collection(
            settings.qdrant_collection, vectors_config=VectorParams(size=dim, distance=Distance.COSINE)
        )
    return QdrantVectorStore(client=client, collection_name=settings.qdrant_collection, embedding=emb)
