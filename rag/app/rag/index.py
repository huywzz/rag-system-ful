from pathlib import Path

from langchain_community.document_loaders import (
    Docx2txtLoader,
    PyPDFLoader,
    TextLoader,
    WebBaseLoader,
)
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client.models import FieldCondition, Filter, FilterSelector, MatchValue

from app.base.llm import EMBED_BATCH
from app.config import settings
from app.rag.vector_store import vector_store

LOADERS = {
    ".pdf": PyPDFLoader,
    ".docx": Docx2txtLoader,
    ".md": lambda p: TextLoader(p, encoding="utf-8"),
    ".txt": lambda p: TextLoader(p, encoding="utf-8"),
}


def load(path: str, source: str) -> list[Document]:
    """Load a local file (or URL when path starts with http) into documents tagged with `source`."""
    if path.startswith(("http://", "https://")):
        docs = WebBaseLoader(path).load()
    else:
        ext = Path(source).suffix.lower()
        if ext not in LOADERS:
            raise ValueError(f"Không hỗ trợ định dạng {ext or '(không có đuôi)'}; hỗ trợ: {', '.join(LOADERS)}")
        docs = LOADERS[ext](path).load()
    for d in docs:
        d.metadata["source"] = source
    return docs


def delete(doc_id: str) -> None:
    store = vector_store()
    store.client.delete(
        settings.qdrant_collection,
        points_selector=FilterSelector(
            filter=Filter(must=[FieldCondition(key="metadata.doc_id", match=MatchValue(value=doc_id))])
        ),
    )


def split(path: str, source: str) -> list[str]:
    """Parse and chunk without embedding, so a human can review the chunks first."""
    chunks = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap
    ).split_documents(load(path, source))
    return [c.page_content for c in chunks if c.page_content.strip()]


def ingest(doc_id: str, source: str, chunks: list[str]) -> int:
    """Embed exactly the approved (possibly hand-edited) chunks; blank ones are dropped."""
    docs = [
        Document(page_content=t, metadata={"source": source, "doc_id": doc_id}) for t in chunks if t.strip()
    ]
    if not docs:
        raise ValueError("Không có nội dung để embedding")
    delete(doc_id)  # re-ingest replaces every old chunk of this document
    for i in range(0, len(docs), EMBED_BATCH):
        vector_store().add_documents(docs[i : i + EMBED_BATCH])
    return len(docs)
