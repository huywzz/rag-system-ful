from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    alibaba_api_key: str
    # Mainland China accounts: https://dashscope.aliyuncs.com/compatible-mode/v1
    alibaba_base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    chat_model: str = "qwen3.8-flash"
    embedding_model: str = "qwen3.7-text-embedding"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "documents"
    chunk_size: int = 1000
    chunk_overlap: int = 150
    top_k: int = 5
    # shared secret with the NestJS API; this service must not be exposed publicly
    internal_token: str
    # R2: https://<account_id>.r2.cloudflarestorage.com
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket: str = "rag"


settings = Settings()
