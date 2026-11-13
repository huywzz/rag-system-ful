import os

import pytest

os.environ.setdefault("ALIBABA_API_KEY", "test")
os.environ.setdefault("INTERNAL_TOKEN", "secret")
from app.rag import index, retrieval  # noqa: E402


def test_load_tags_source_and_reads_utf8(tmp_path):
    f = tmp_path / "upload.tmp"
    f.write_text("Quy định nghỉ phép: 12 ngày/năm.", encoding="utf-8")
    docs = index.load(str(f), "quy-dinh.md")
    assert docs[0].page_content.startswith("Quy định")
    assert docs[0].metadata["source"] == "quy-dinh.md"


def test_load_rejects_unknown_extension(tmp_path):
    f = tmp_path / "x.exe"
    f.write_bytes(b"\0")
    with pytest.raises(ValueError):
        index.load(str(f), "x.exe")


def test_ask_uses_given_history_and_embeds_plain_str(monkeypatch):
    from langchain_core.messages import AIMessage

    seen, prompts = [], []

    class LLM:
        def invoke(self, msgs):
            prompts.append(msgs)
            return AIMessage(content=[{"type": "text", "text": "câu hỏi đầy đủ"}])

    class Store:
        def similarity_search(self, q, k):
            seen.append(type(q))
            return []

    monkeypatch.setattr(retrieval, "llm", lambda: LLM())
    monkeypatch.setattr(retrieval, "vector_store", lambda: Store())
    out = retrieval.ask("tiếp?", [{"role": "user", "content": "hỏi trước"}, {"role": "assistant", "content": "đáp trước"}])
    assert seen == [str]  # exact str, not TextAccessor subclass
    assert type(out["answer"]) is str
    assert [type(m).__name__ for m in prompts[0][1:3]] == ["HumanMessage", "AIMessage"]


def test_api_requires_internal_token():
    from fastapi.testclient import TestClient

    from app import api

    client = TestClient(api.app)
    assert client.post("/ask", json={"question": "x"}).status_code == 401
    r = client.post("/parse", json={"name": "a.pdf"}, headers={"X-Internal-Token": "secret"})
    assert r.status_code == 422  # neither key nor url


def test_split_returns_plain_chunks_without_blank_ones(tmp_path):
    f = tmp_path / "u.tmp"
    f.write_text("Điều 1. Nghỉ phép 12 ngày.\n\n   \n", encoding="utf-8")
    assert index.split(str(f), "a.md") == ["Điều 1. Nghỉ phép 12 ngày."]


def test_ingest_embeds_given_chunks_tagged_with_doc(monkeypatch):
    added, deleted = [], []

    class Store:
        def add_documents(self, docs):
            added.extend(docs)

    monkeypatch.setattr(index, "vector_store", lambda: Store())
    monkeypatch.setattr(index, "delete", deleted.append)
    assert index.ingest("d1", "a.pdf", ["đoạn 1 đã sửa", "  ", "đoạn 2"]) == 2
    assert [d.page_content for d in added] == ["đoạn 1 đã sửa", "đoạn 2"]
    assert added[0].metadata == {"source": "a.pdf", "doc_id": "d1"}
    assert deleted == ["d1"]


def test_ingest_rejects_all_blank():
    with pytest.raises(ValueError):
        index.ingest("d1", "a.pdf", ["", "  "])
