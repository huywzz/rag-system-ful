from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.base.llm import llm
from app.config import settings
from app.rag.vector_store import vector_store

CONDENSE_PROMPT = (
    "Dựa vào lịch sử hội thoại, viết lại câu hỏi cuối của người dùng thành một câu hỏi "
    "độc lập, đầy đủ ngữ cảnh, bằng tiếng Việt. Chỉ trả về câu hỏi."
)
ANSWER_PROMPT = (
    "Bạn là trợ lý hỏi đáp trên kho tài liệu nội bộ. Chỉ trả lời dựa trên ngữ cảnh dưới đây, "
    "bằng tiếng Việt. Nếu ngữ cảnh không có thông tin, nói rõ là không tìm thấy trong tài liệu.\n\n"
    "Ngữ cảnh:\n{context}"
)


def ask(question: str, history: list[dict]) -> dict:
    """history: [{"role": "user"|"assistant", "content": str}], owned and stored by the NestJS API."""
    past: list[BaseMessage] = [
        HumanMessage(m["content"]) if m["role"] == "user" else AIMessage(m["content"]) for m in history
    ]
    query = question
    if past:
        # str(): .text may be a TextAccessor (str subclass); embed/store a plain str
        query = str(llm().invoke([SystemMessage(CONDENSE_PROMPT), *past, HumanMessage(question)]).text)

    docs = vector_store().similarity_search(query, k=settings.top_k)
    context = "\n\n---\n\n".join(f"[{d.metadata.get('source')}]\n{d.page_content}" for d in docs)
    answer = str(llm().invoke(
        [SystemMessage(ANSWER_PROMPT.format(context=context)), *past, HumanMessage(question)]
    ).text)
    return {"answer": answer, "sources": sorted({d.metadata.get("source") for d in docs})}
