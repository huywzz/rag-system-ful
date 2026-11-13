from functools import lru_cache

from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.config import settings

EMBED_BATCH = 10  # DashScope embedding batch limit (10 on older models, 20 on qwen3.7)


@lru_cache
def llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.chat_model,
        api_key=settings.alibaba_api_key,
        base_url=settings.alibaba_base_url,
        # thinking is on by default for qwen3.x: slower, and DashScope rejects it on non-streaming calls
        extra_body={"enable_thinking": False},
    )


@lru_cache
def embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.alibaba_api_key,
        base_url=settings.alibaba_base_url,
        check_embedding_ctx_length=False,  # send raw strings; DashScope rejects tiktoken token-id input
        chunk_size=EMBED_BATCH,  # DashScope caps inputs per embedding request
    )
